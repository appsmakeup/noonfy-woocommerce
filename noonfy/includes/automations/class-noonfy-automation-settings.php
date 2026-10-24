<?php
/**
 * Store-wide automation settings.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * - cartCapture: save carts of signed-in shoppers and of guests once they type their email at checkout.
 * - cartNotice: the short notice shown to guests at checkout while cart capture is on.
 * - browseTracking: remember which products signed-in shoppers view (for browse abandonment).
 */
class Noonfy_Automation_Settings {

	const OPTION = 'noonfy_automation_settings';

	/** @return array */
	public static function defaults() {
		return array(
			'cartCapture'    => true,
			'cartNotice'     => __( 'We save your cart while you shop, so we can email you a reminder if you don’t finish checking out.', 'noonfy' ),
			'browseTracking' => true,
		);
	}

	/** @return array */
	public static function get() {
		return array_merge( self::defaults(), array_intersect_key( (array) get_option( self::OPTION, array() ), self::defaults() ) );
	}

	/**
	 * @param array $in Changed fields.
	 * @return array Saved settings.
	 */
	public static function update( array $in ) {
		$s = self::get();
		foreach ( array( 'cartCapture', 'browseTracking' ) as $k ) {
			if ( array_key_exists( $k, $in ) ) {
				$s[ $k ] = rest_sanitize_boolean( $in[ $k ] );
			}
		}
		if ( array_key_exists( 'cartNotice', $in ) ) {
			$notice          = mb_substr( sanitize_text_field( (string) $in['cartNotice'] ), 0, 300 );
			$s['cartNotice'] = '' !== $notice ? $notice : self::defaults()['cartNotice'];
		}
		update_option( self::OPTION, $s, false );
		return $s;
	}
}
