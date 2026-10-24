<?php
/**
 * Encryption for stored provider credentials.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Encrypts secrets with libsodium (bundled with PHP 7.2+, polyfilled by WordPress otherwise).
 *
 * The key comes from the NOONFY_SECRET_KEY constant when defined in wp-config.php, otherwise from the
 * site's auth salts. Changing either makes saved passwords unreadable, so they must be re-entered.
 */
class Noonfy_Crypto {

	const PREFIX = 'nf1:';

	/** @return string 32-byte key. */
	private static function key() {
		$secret = defined( 'NOONFY_SECRET_KEY' ) ? (string) NOONFY_SECRET_KEY : wp_salt( 'auth' ) . wp_salt( 'secure_auth' );
		return hash( 'sha256', 'noonfy|' . $secret, true );
	}

	/**
	 * @param string $plain Secret.
	 * @return string Prefixed, base64-encoded nonce + ciphertext ('' for an empty secret).
	 */
	public static function encrypt( $plain ) {
		$plain = (string) $plain;
		if ( '' === $plain ) {
			return '';
		}
		$nonce = random_bytes( SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
		return self::PREFIX . base64_encode( $nonce . sodium_crypto_secretbox( $plain, $nonce, self::key() ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	}

	/**
	 * @param string $stored Value produced by encrypt().
	 * @return string The secret, or '' if it can't be decrypted.
	 */
	public static function decrypt( $stored ) {
		if ( ! is_string( $stored ) || 0 !== strpos( $stored, self::PREFIX ) ) {
			return '';
		}
		$raw = base64_decode( substr( $stored, strlen( self::PREFIX ) ), true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		if ( false === $raw || strlen( $raw ) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES + SODIUM_CRYPTO_SECRETBOX_MACBYTES ) {
			return '';
		}
		$nonce = substr( $raw, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
		$plain = sodium_crypto_secretbox_open( substr( $raw, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ), $nonce, self::key() );
		return false === $plain ? '' : $plain;
	}
}
