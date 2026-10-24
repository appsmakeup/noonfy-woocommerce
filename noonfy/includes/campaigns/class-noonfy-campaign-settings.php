<?php
/**
 * Store-wide campaign settings.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Audience mode, checkout opt-in, footer address and sending pace.
 */
class Noonfy_Campaign_Settings {

	const OPTION = 'noonfy_campaign_settings';

	/** @return array */
	public static function defaults() {
		return array(
			// 'optin': only contacts who opted in. 'all': also customers who never opted in (store's responsibility).
			'audienceMode'   => 'optin',
			'checkoutOptin'  => true,
			'optinLabel'     => __( 'Send me news and offers by email', 'noonfy' ),
			'companyAddress' => self::store_address(),
			'batchSize'      => 50,
		);
	}

	/** @return string WooCommerce store address on one line, if configured. */
	private static function store_address() {
		$parts = array(
			get_bloginfo( 'name' ),
			get_option( 'woocommerce_store_address' ),
			get_option( 'woocommerce_store_address_2' ),
			trim( get_option( 'woocommerce_store_city' ) . ' ' . get_option( 'woocommerce_store_postcode' ) ),
		);
		return implode( ' · ', array_filter( array_map( 'trim', array_map( 'strval', $parts ) ) ) );
	}

	/** @return array */
	public static function get() {
		$stored = get_option( self::OPTION, array() );
		return self::sanitize( array_merge( self::defaults(), is_array( $stored ) ? $stored : array() ) );
	}

	/**
	 * @param array $patch Changed settings.
	 * @return array Saved settings.
	 */
	public static function update( array $patch ) {
		$next = self::sanitize( array_merge( self::get(), $patch ) );
		update_option( self::OPTION, $next );
		return $next;
	}

	/**
	 * @param array $in Settings.
	 * @return array
	 */
	private static function sanitize( array $in ) {
		$d = self::defaults();
		return array(
			'audienceMode'   => in_array( $in['audienceMode'] ?? '', array( 'optin', 'all' ), true ) ? $in['audienceMode'] : $d['audienceMode'],
			'checkoutOptin'  => rest_sanitize_boolean( $in['checkoutOptin'] ?? true ),
			'optinLabel'     => '' !== trim( (string) ( $in['optinLabel'] ?? '' ) ) ? sanitize_text_field( $in['optinLabel'] ) : $d['optinLabel'],
			'companyAddress' => sanitize_text_field( (string) ( $in['companyAddress'] ?? '' ) ),
			'batchSize'      => max( 10, min( 500, (int) ( $in['batchSize'] ?? 50 ) ) ),
		);
	}
}
