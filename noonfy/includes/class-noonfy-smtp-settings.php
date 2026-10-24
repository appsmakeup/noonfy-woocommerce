<?php
/**
 * SMTP screen settings: storage, defaults and validation.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Stores the SMTP screen's settings in a single option.
 *
 * Keys mirror the admin app's `PersistedSettings` type (src/config.ts).
 */
class Noonfy_SMTP_Settings {

	const OPTION = 'noonfy_smtp_settings';

	/** Routing rule ids. */
	const RULES = array( 'r1', 'r2', 'r3', 'r4', 'r5' );

	/** Alert rule ids. */
	const ALERTS = array( 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8' );

	/** Rotation strategies. */
	const STRATEGIES = array( 'weighted', 'roundrobin', 'priority', 'leastused', 'fastest', 'cost', 'deliverability', 'health' );

	/**
	 * Defaults for a fresh install. Rule/alert maps start empty: the app treats a missing id as its default.
	 *
	 * @return array
	 */
	public static function defaults() {
		return array(
			'strategy'  => 'priority',
			'rules'     => array(),
			'alerts'    => array(),
			'retention' => 30,
			'fromName'  => wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ),
			'fromEmail' => (string) get_option( 'admin_email' ),
			'forceFrom' => false,
		);
	}

	/**
	 * Current settings, merged over defaults.
	 *
	 * @return array
	 */
	public static function get() {
		$stored = get_option( self::OPTION, array() );
		$merged = array_merge( self::defaults(), is_array( $stored ) ? $stored : array() );
		$clean  = self::sanitize( $merged, self::defaults() );
		return is_wp_error( $clean ) ? self::defaults() : $clean;
	}

	/**
	 * Applies a partial update and saves it.
	 *
	 * @param array $patch Subset of settings keys.
	 * @return array|WP_Error Saved settings, or the validation error.
	 */
	public static function update( array $patch ) {
		$current = self::get();
		$next    = self::sanitize( array_merge( $current, $patch ), $current );
		if ( is_wp_error( $next ) ) {
			return $next;
		}
		update_option( self::OPTION, $next, false );
		return $next;
	}

	/**
	 * Validates a full settings array. Unknown keys and ids are dropped; bad values fall back to `$base`.
	 *
	 * @param array $input Settings to validate.
	 * @param array $base  Values to fall back to.
	 * @return array|WP_Error
	 */
	public static function sanitize( array $input, array $base ) {
		$out = array(
			'strategy'  => in_array( $input['strategy'] ?? '', self::STRATEGIES, true ) ? $input['strategy'] : $base['strategy'],
			'rules'     => self::bool_map( $input['rules'] ?? array(), self::RULES ),
			'alerts'    => self::bool_map( $input['alerts'] ?? array(), self::ALERTS ),
			'retention' => $base['retention'],
			'fromName'  => sanitize_text_field( (string) ( $input['fromName'] ?? '' ) ),
			'fromEmail' => sanitize_email( (string) ( $input['fromEmail'] ?? '' ) ),
			'forceFrom' => rest_sanitize_boolean( $input['forceFrom'] ?? false ),
		);

		if ( isset( $input['retention'] ) && is_numeric( $input['retention'] ) ) {
			// Slider range is 7–180 days.
			$out['retention'] = max( 7, min( 180, (int) $input['retention'] ) );
		}

		$raw_email = trim( (string) ( $input['fromEmail'] ?? '' ) );
		if ( '' !== $raw_email && ( '' === $out['fromEmail'] || ! is_email( $out['fromEmail'] ) ) ) {
			return new WP_Error( 'noonfy_invalid_from_email', __( 'Default from email is not a valid address.', 'noonfy' ), array( 'status' => 400 ) );
		}

		return $out;
	}

	/**
	 * Keeps only whitelisted ids, cast to booleans.
	 *
	 * @param mixed    $map     Candidate id => bool map.
	 * @param string[] $allowed Allowed ids.
	 * @return array
	 */
	private static function bool_map( $map, array $allowed ) {
		$out = array();
		if ( ! is_array( $map ) ) {
			return $out;
		}
		foreach ( $map as $id => $on ) {
			if ( in_array( (string) $id, $allowed, true ) ) {
				$out[ (string) $id ] = rest_sanitize_boolean( $on );
			}
		}
		return $out;
	}
}
