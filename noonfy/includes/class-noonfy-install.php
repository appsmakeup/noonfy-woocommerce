<?php
/**
 * Database schema install and upgrades.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Creates every Noonfy table with dbDelta and tracks the schema version.
 */
class Noonfy_Install {

	const DB_VERSION = '3';
	const OPTION     = 'noonfy_db_version';

	/** Creates or upgrades all tables. */
	public static function install() {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		Noonfy_Email_Log::create_table();
		Noonfy_Contacts::create_table();
		Noonfy_Campaigns::create_tables();
		update_option( self::OPTION, self::DB_VERSION );
	}

	/** Runs install() when the stored schema version is behind (e.g. after uploading a new version). */
	public static function maybe_upgrade() {
		if ( get_option( self::OPTION ) !== self::DB_VERSION ) {
			self::install();
		}
	}
}
