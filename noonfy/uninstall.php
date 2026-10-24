<?php
/**
 * Removes Noonfy's data when the plugin is deleted.
 *
 * @package Noonfy
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

global $wpdb;

foreach ( array( 'noonfy_smtp_settings', 'noonfy_smtp_connections', 'noonfy_db_version', 'noonfy_rr_index', 'noonfy_campaign_settings' ) as $noonfy_option ) {
	delete_option( $noonfy_option );
}
wp_clear_scheduled_hook( 'noonfy_purge_email_log' );
wp_unschedule_hook( 'noonfy_campaign_start' );
wp_unschedule_hook( 'noonfy_campaign_batch' );
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'noonfy\\_campaign\\_lock\\_%'" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
foreach ( array( 'noonfy_email_log', 'noonfy_campaign_recipients', 'noonfy_campaigns', 'noonfy_contacts' ) as $noonfy_table ) {
	$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}{$noonfy_table}" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
}
