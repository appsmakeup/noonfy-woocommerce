<?php
/**
 * Removes Noonfy's data when the plugin is deleted.
 *
 * @package Noonfy
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

global $wpdb;

foreach ( array( 'noonfy_smtp_settings', 'noonfy_smtp_connections', 'noonfy_db_version', 'noonfy_rr_index' ) as $noonfy_option ) {
	delete_option( $noonfy_option );
}
wp_clear_scheduled_hook( 'noonfy_purge_email_log' );
$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}noonfy_email_log" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
