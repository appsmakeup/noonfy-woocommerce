<?php
/**
 * Plugin Name:          Noonfy – AI Customer Engagement
 * Plugin URI:           https://noonfy.com
 * Description:          Email marketing, automation and multi-provider SMTP delivery for WooCommerce stores.
 * Version:              0.2.0
 * Requires at least:    6.6
 * Requires PHP:         7.4
 * Requires Plugins:     woocommerce
 * Author:               Noonfy
 * License:              GPL-2.0-or-later
 * License URI:          https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:          noonfy
 * WC requires at least: 8.2
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

define( 'NOONFY_VERSION', '0.2.0' );
define( 'NOONFY_FILE', __FILE__ );
define( 'NOONFY_DIR', plugin_dir_path( __FILE__ ) );
define( 'NOONFY_URL', plugin_dir_url( __FILE__ ) );

require_once NOONFY_DIR . 'includes/class-noonfy-crypto.php';
require_once NOONFY_DIR . 'includes/class-noonfy-providers.php';
require_once NOONFY_DIR . 'includes/class-noonfy-connections.php';
require_once NOONFY_DIR . 'includes/class-noonfy-email-log.php';
require_once NOONFY_DIR . 'includes/class-noonfy-smtp-settings.php';
require_once NOONFY_DIR . 'includes/class-noonfy-mailer.php';
require_once NOONFY_DIR . 'includes/class-noonfy-smtp-rest.php';
require_once NOONFY_DIR . 'includes/class-noonfy-admin.php';

const NOONFY_PURGE_HOOK = 'noonfy_purge_email_log';

register_activation_hook(
	__FILE__,
	static function () {
		Noonfy_Email_Log::install();
		if ( ! wp_next_scheduled( NOONFY_PURGE_HOOK ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', NOONFY_PURGE_HOOK );
		}
	}
);

register_deactivation_hook(
	__FILE__,
	static function () {
		wp_clear_scheduled_hook( NOONFY_PURGE_HOOK );
	}
);

// Daily: delete log rows older than the retention setting.
add_action(
	NOONFY_PURGE_HOOK,
	static function () {
		Noonfy_Email_Log::purge( Noonfy_SMTP_Settings::get()['retention'] );
	}
);

// Noonfy never reads or writes order tables directly, so it is compatible with HPOS.
add_action(
	'before_woocommerce_init',
	static function () {
		if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', NOONFY_FILE, true );
		}
	}
);

add_action(
	'plugins_loaded',
	static function () {
		// Mail routing runs even if WooCommerce is later deactivated, so the site's email transport
		// never changes silently.
		Noonfy_Email_Log::maybe_upgrade();
		Noonfy_Mailer::init();
		if ( is_admin() && ! wp_next_scheduled( NOONFY_PURGE_HOOK ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', NOONFY_PURGE_HOOK );
		}

		// "Requires Plugins" blocks activation without WooCommerce on WP 6.5+; this guards older paths
		// (e.g. WooCommerce deactivated afterwards, or the plugin loaded as a must-use plugin).
		if ( ! class_exists( 'WooCommerce' ) ) {
			add_action(
				'admin_notices',
				static function () {
					if ( current_user_can( 'activate_plugins' ) ) {
						echo '<div class="notice notice-error"><p>' . esc_html__( 'Noonfy requires WooCommerce to be installed and active.', 'noonfy' ) . '</p></div>';
					}
				}
			);
			return;
		}

		Noonfy_SMTP_REST::init();
		Noonfy_Admin::init();
	}
);
