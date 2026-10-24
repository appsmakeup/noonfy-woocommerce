<?php
/**
 * Removes Noonfy's data when the plugin is deleted.
 *
 * @package Noonfy
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'noonfy_smtp_settings' );
