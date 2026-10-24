<?php
/**
 * wp-admin integration: menu, assets and the app mount point.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Registers the "AI Customer Engagement" admin menu and boots the React app on its screens.
 * One bundle serves every screen; the mount point's id tells it which screen to render.
 */
class Noonfy_Admin {

	const SLUG       = 'noonfy-smtp';
	const CAMPAIGNS  = 'noonfy-campaigns';
	const CAPABILITY = 'manage_woocommerce';

	/** @var array<string, string> Screen key => hook suffix. */
	private static $hooks = array();

	/** Hooks into wp-admin. */
	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
		add_filter( 'admin_body_class', array( __CLASS__, 'body_class' ) );
	}

	/** Top-level menu (placed after WooCommerce's menus), with the SMTP screen as its first item. */
	public static function register_menu() {
		self::$hooks['smtp'] = add_menu_page(
			__( 'SMTP & Email Delivery', 'noonfy' ),
			__( 'AI Customer Engagement', 'noonfy' ),
			self::CAPABILITY,
			self::SLUG,
			array( __CLASS__, 'render_smtp' ),
			'dashicons-email-alt',
			58.5
		);
		add_submenu_page(
			self::SLUG,
			__( 'SMTP & Email Delivery', 'noonfy' ),
			__( 'SMTP & Delivery', 'noonfy' ),
			self::CAPABILITY,
			self::SLUG,
			array( __CLASS__, 'render_smtp' )
		);
		self::$hooks['campaigns'] = add_submenu_page(
			self::SLUG,
			__( 'Email Campaigns', 'noonfy' ),
			__( 'Campaigns', 'noonfy' ),
			self::CAPABILITY,
			self::CAMPAIGNS,
			array( __CLASS__, 'render_campaigns' )
		);
	}

	/** @return string|null Key of the current Noonfy screen. */
	private static function current_screen_key() {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		$key    = $screen ? array_search( $screen->id, self::$hooks, true ) : false;
		return false === $key ? null : $key;
	}

	/**
	 * @param string $classes Space-separated body classes.
	 * @return string
	 */
	public static function body_class( $classes ) {
		return self::current_screen_key() ? $classes . ' noonfy-admin' : $classes;
	}

	/**
	 * Enqueues the built app and hands it its boot data.
	 *
	 * @param string $hook_suffix Current admin screen hook.
	 */
	public static function enqueue_assets( $hook_suffix ) {
		$screen = array_search( $hook_suffix, self::$hooks, true );
		if ( false === $screen ) {
			return;
		}

		$asset_file = NOONFY_DIR . 'build/smtp.asset.php';
		if ( ! file_exists( $asset_file ) ) {
			add_action( 'admin_notices', array( __CLASS__, 'missing_build_notice' ) );
			return;
		}
		$asset = require $asset_file;

		wp_enqueue_script( 'noonfy-smtp', NOONFY_URL . 'build/smtp.js', $asset['dependencies'], $asset['version'], true );
		wp_enqueue_style( 'noonfy-smtp', NOONFY_URL . 'build/smtp.css', array(), $asset['version'] );
		wp_style_add_data( 'noonfy-smtp', 'rtl', 'replace' );

		$boot = 'window.noonfyApp = ' . wp_json_encode( self::app_data() ) . ';';
		if ( 'campaigns' === $screen ) {
			wp_enqueue_media(); // Image block: WordPress media library picker.
			$boot .= 'window.noonfyCampaigns = ' . wp_json_encode( self::campaigns_data() ) . ';';
		} else {
			$boot .= 'window.noonfySmtp = ' . wp_json_encode( self::smtp_data() ) . ';';
		}
		wp_add_inline_script( 'noonfy-smtp', $boot, 'before' );
	}

	/** Shared data, read as `window.noonfyApp` (typed in src/config.ts). */
	private static function app_data() {
		$user = wp_get_current_user();
		$name = $user->display_name ? $user->display_name : $user->user_login;
		return array(
			'user'    => array(
				'name'     => $name,
				'initials' => self::initials( $name ),
				'email'    => $user->user_email,
			),
			'site'    => array(
				'name' => wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ),
				'host' => (string) wp_parse_url( home_url(), PHP_URL_HOST ),
				'home' => home_url( '/' ),
			),
			'screens' => array(
				'smtp'      => admin_url( 'admin.php?page=' . self::SLUG ),
				'campaigns' => admin_url( 'admin.php?page=' . self::CAMPAIGNS ),
			),
			'links'   => array(
				'wooProducts'     => admin_url( 'edit.php?post_type=product' ),
				'wooOrders'       => self::orders_url(),
				'wooCategories'   => admin_url( 'edit-tags.php?taxonomy=product_cat&post_type=product' ),
				'wooCoupons'      => admin_url( 'edit.php?post_type=shop_coupon' ),
				'wcEmailSettings' => admin_url( 'admin.php?page=wc-settings&tab=email' ),
			),
		);
	}

	/** Campaigns screen data, read as `window.noonfyCampaigns` (typed in src/campaigns/types.ts). */
	private static function campaigns_data() {
		return Noonfy_Campaigns_REST::overview() + array(
			'settings' => Noonfy_Campaign_Settings::get(),
			'emojis'   => Noonfy_Campaigns::EMOJIS,
			'currency' => array(
				'symbol'   => function_exists( 'get_woocommerce_currency_symbol' ) ? html_entity_decode( get_woocommerce_currency_symbol(), ENT_QUOTES ) : '$',
				'position' => (string) get_option( 'woocommerce_currency_pos', 'left' ),
				'decimals' => function_exists( 'wc_get_price_decimals' ) ? wc_get_price_decimals() : 2,
			),
			'timezone' => wp_timezone_string(),
		);
	}

	/** SMTP screen data, read as `window.noonfySmtp`. */
	private static function smtp_data() {
		global $wp_version;

		return array(
			'restPath'    => Noonfy_SMTP_REST::NS . '/smtp',
			'settings'    => Noonfy_SMTP_Settings::get(),
			'presets'     => Noonfy_Providers::all(),
			'connections' => Noonfy_Connections::all_public(),
			'stats'       => Noonfy_Email_Log::stats(),
			'recentLogs'  => Noonfy_Email_Log::query( array( 'limit' => 10 ) )['rows'],
			'system'      => array(
				'purgeScheduled' => (bool) wp_next_scheduled( NOONFY_PURGE_HOOK ),
				'openssl'        => extension_loaded( 'openssl' ),
				'php'            => PHP_VERSION,
				'wordpress'      => $wp_version,
				'woocommerce'    => defined( 'WC_VERSION' ) ? WC_VERSION : '',
			),
		);
	}

	/** Orders screen URL, respecting HPOS. */
	private static function orders_url() {
		$util = \Automattic\WooCommerce\Utilities\OrderUtil::class;
		if ( class_exists( $util ) && $util::custom_orders_table_usage_is_enabled() ) {
			return admin_url( 'admin.php?page=wc-orders' );
		}
		return admin_url( 'edit.php?post_type=shop_order' );
	}

	/**
	 * Up to two initials for the sidebar avatar, e.g. "Sam Dorel" → "SD".
	 *
	 * @param string $name Display name.
	 * @return string
	 */
	private static function initials( $name ) {
		$parts    = preg_split( '/\s+/u', trim( $name ), -1, PREG_SPLIT_NO_EMPTY );
		$initials = '';
		foreach ( array_slice( (array) $parts, 0, 2 ) as $part ) {
			$initials .= function_exists( 'mb_substr' ) ? mb_substr( $part, 0, 1 ) : substr( $part, 0, 1 );
		}
		return function_exists( 'mb_strtoupper' ) ? mb_strtoupper( $initials ) : strtoupper( $initials );
	}

	/** Shown when the JS bundle hasn't been built. */
	public static function missing_build_notice() {
		echo '<div class="notice notice-error"><p>' . esc_html__( 'Noonfy admin assets are missing. Run `npm install && npm run build` in the plugin folder.', 'noonfy' ) . '</p></div>';
	}

	/** SMTP screen mount point. */
	public static function render_smtp() {
		self::render( 'noonfy-smtp-root' );
	}

	/** Campaigns screen mount point. */
	public static function render_campaigns() {
		self::render( 'noonfy-campaigns-root' );
	}

	/** @param string $id Mount point id. */
	private static function render( $id ) {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'Sorry, you are not allowed to access this page.', 'noonfy' ) );
		}
		echo '<div id="' . esc_attr( $id ) . '" class="nf-app"></div>';
	}
}
