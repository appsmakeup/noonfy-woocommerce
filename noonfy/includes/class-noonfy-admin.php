<?php
/**
 * wp-admin integration: menu, assets and the app mount point.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Registers the "AI Customer Engagement" admin menu and boots the React app on its screen.
 */
class Noonfy_Admin {

	const SLUG       = 'noonfy-smtp';
	const CAPABILITY = 'manage_woocommerce';

	/** Screen hook suffix returned by add_menu_page(). */
	private static $hook = '';

	/** Hooks into wp-admin. */
	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
		add_filter( 'admin_body_class', array( __CLASS__, 'body_class' ) );
	}

	/** Top-level menu (placed after WooCommerce's menus), with the SMTP screen as its first item. */
	public static function register_menu() {
		self::$hook = add_menu_page(
			__( 'SMTP & Email Delivery', 'noonfy' ),
			__( 'AI Customer Engagement', 'noonfy' ),
			self::CAPABILITY,
			self::SLUG,
			array( __CLASS__, 'render' ),
			'dashicons-email-alt',
			58.5
		);
		add_submenu_page(
			self::SLUG,
			__( 'SMTP & Email Delivery', 'noonfy' ),
			__( 'SMTP & Delivery', 'noonfy' ),
			self::CAPABILITY,
			self::SLUG,
			array( __CLASS__, 'render' )
		);
	}

	/** @return bool Whether the current request is a Noonfy screen. */
	private static function is_noonfy_screen() {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		return $screen && self::$hook && $screen->id === self::$hook;
	}

	/**
	 * @param string $classes Space-separated body classes.
	 * @return string
	 */
	public static function body_class( $classes ) {
		return self::is_noonfy_screen() ? $classes . ' noonfy-admin' : $classes;
	}

	/**
	 * Enqueues the built app and hands it its boot data.
	 *
	 * @param string $hook_suffix Current admin screen hook.
	 */
	public static function enqueue_assets( $hook_suffix ) {
		if ( $hook_suffix !== self::$hook ) {
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
		wp_add_inline_script( 'noonfy-smtp', 'window.noonfySmtp = ' . wp_json_encode( self::boot_data() ) . ';', 'before' );
	}

	/** Data the app reads as `window.noonfySmtp` (typed in src/config.ts). */
	private static function boot_data() {
		$user = wp_get_current_user();
		$name = $user->display_name ? $user->display_name : $user->user_login;

		return array(
			'restPath' => Noonfy_SMTP_REST::NS . '/smtp',
			'settings' => Noonfy_SMTP_Settings::get(),
			'user'     => array(
				'name'     => $name,
				'initials' => self::initials( $name ),
				'email'    => $user->user_email,
			),
			'site'     => array(
				'name' => wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ),
				'host' => (string) wp_parse_url( home_url(), PHP_URL_HOST ),
			),
			'links'    => array(
				'wooProducts'     => admin_url( 'edit.php?post_type=product' ),
				'wooOrders'       => self::orders_url(),
				'wooCategories'   => admin_url( 'edit-tags.php?taxonomy=product_cat&post_type=product' ),
				'wooCoupons'      => admin_url( 'edit.php?post_type=shop_coupon' ),
				'wcEmailSettings' => admin_url( 'admin.php?page=wc-settings&tab=email' ),
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

	/** App mount point. */
	public static function render() {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'Sorry, you are not allowed to access this page.', 'noonfy' ) );
		}
		echo '<div id="noonfy-smtp-root" class="nf-app"></div>';
	}
}
