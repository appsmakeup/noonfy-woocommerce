<?php
/**
 * SMTP connections: storage and validation.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Stores SMTP connections in one option. Passwords are encrypted and never leave the server.
 */
class Noonfy_Connections {

	const OPTION     = 'noonfy_smtp_connections';
	const ENCRYPTION = array( 'none', 'ssl', 'tls' );

	/** @return array<string, array> Raw connections keyed by id (password encrypted). */
	private static function raw() {
		$stored = get_option( self::OPTION, array() );
		return is_array( $stored ) ? $stored : array();
	}

	/** @param array<string, array> $all Connections keyed by id. */
	private static function save_all( array $all ) {
		update_option( self::OPTION, $all );
	}

	/**
	 * All connections, lowest priority number first.
	 *
	 * @return array[] Raw connections (password encrypted).
	 */
	public static function all() {
		$all = array_values( self::raw() );
		usort(
			$all,
			static function ( $a, $b ) {
				return array( $a['priority'], $a['createdAt'] ) <=> array( $b['priority'], $b['createdAt'] );
			}
		);
		return $all;
	}

	/** @return array[] Enabled connections, lowest priority number first. */
	public static function enabled() {
		return array_values(
			array_filter(
				self::all(),
				static function ( $c ) {
					return ! empty( $c['enabled'] );
				}
			)
		);
	}

	/**
	 * @param string $id Connection id.
	 * @return array|null Raw connection.
	 */
	public static function get( $id ) {
		$all = self::raw();
		return $all[ $id ] ?? null;
	}

	/**
	 * Shape sent to the browser: the password is replaced by a flag.
	 *
	 * @param array $c Raw connection.
	 * @return array
	 */
	public static function to_public( array $c ) {
		$c['hasPassword'] = '' !== ( $c['password'] ?? '' );
		unset( $c['password'] );
		return $c;
	}

	/** @return array[] All connections in browser shape. */
	public static function all_public() {
		return array_map( array( __CLASS__, 'to_public' ), self::all() );
	}

	/**
	 * @param array $input Fields from the form.
	 * @return array|WP_Error The new connection (browser shape).
	 */
	public static function create( array $input ) {
		$conn = self::sanitize( $input, null );
		if ( is_wp_error( $conn ) ) {
			return $conn;
		}
		$conn['id']        = 'c_' . strtolower( wp_generate_password( 10, false ) );
		$conn['createdAt'] = time();
		$conn['lastTest']  = null;

		$all              = self::raw();
		$all[ $conn['id'] ] = $conn;
		self::save_all( $all );
		return self::to_public( $conn );
	}

	/**
	 * Partial update. An empty or missing password keeps the saved one.
	 *
	 * @param string $id    Connection id.
	 * @param array  $input Changed fields.
	 * @return array|WP_Error The updated connection (browser shape).
	 */
	public static function update( $id, array $input ) {
		$all = self::raw();
		if ( ! isset( $all[ $id ] ) ) {
			return new WP_Error( 'noonfy_not_found', __( 'Connection not found.', 'noonfy' ), array( 'status' => 404 ) );
		}
		$conn = self::sanitize( $input, $all[ $id ] );
		if ( is_wp_error( $conn ) ) {
			return $conn;
		}
		$all[ $id ] = array_merge( $all[ $id ], $conn );
		self::save_all( $all );
		return self::to_public( $all[ $id ] );
	}

	/**
	 * @param string $id Connection id.
	 * @return bool Whether it existed.
	 */
	public static function delete( $id ) {
		$all = self::raw();
		if ( ! isset( $all[ $id ] ) ) {
			return false;
		}
		unset( $all[ $id ] );
		self::save_all( $all );
		return true;
	}

	/**
	 * Remembers the outcome of the latest connection test.
	 *
	 * @param string      $id         Connection id.
	 * @param bool        $ok         Whether the handshake succeeded.
	 * @param int|null    $latency_ms Handshake time.
	 * @param string|null $error      Error message.
	 */
	public static function record_test( $id, $ok, $latency_ms, $error ) {
		$all = self::raw();
		if ( ! isset( $all[ $id ] ) ) {
			return;
		}
		$all[ $id ]['lastTest'] = array(
			'at'        => time(),
			'ok'        => (bool) $ok,
			'latencyMs' => null === $latency_ms ? null : (int) $latency_ms,
			'error'     => $error ? (string) $error : null,
		);
		self::save_all( $all );
	}

	/**
	 * SMTP settings with the password decrypted, for PHPMailer.
	 *
	 * @param array $c Raw connection.
	 * @return array{host:string,port:int,encryption:string,username:string,password:string}
	 */
	public static function smtp_config( array $c ) {
		return array(
			'host'       => $c['host'],
			'port'       => (int) $c['port'],
			'encryption' => $c['encryption'],
			'username'   => $c['username'],
			'password'   => Noonfy_Crypto::decrypt( $c['password'] ?? '' ),
		);
	}

	/**
	 * Validates connection fields. With `$existing`, missing fields keep their saved values.
	 *
	 * @param array      $in       Submitted fields.
	 * @param array|null $existing Saved connection when updating.
	 * @return array|WP_Error Raw connection fields (password encrypted).
	 */
	public static function sanitize( array $in, $existing ) {
		$base = $existing ? $existing : array(
			'provider'   => 'smtp',
			'name'       => '',
			'host'       => '',
			'port'       => 587,
			'encryption' => 'tls',
			'username'   => '',
			'password'   => '',
			'fromEmail'  => '',
			'fromName'   => '',
			'priority'   => count( self::raw() ) + 1,
			'weight'     => 0,
			'dailyLimit' => 0,
			'enabled'    => true,
		);
		$get  = static function ( $key ) use ( $in, $base ) {
			return array_key_exists( $key, $in ) ? $in[ $key ] : $base[ $key ];
		};
		$err  = static function ( $message ) {
			return new WP_Error( 'noonfy_invalid_connection', $message, array( 'status' => 400 ) );
		};

		$provider = (string) $get( 'provider' );
		$preset   = Noonfy_Providers::get( $provider );
		if ( ! $preset ) {
			return $err( __( 'Unknown provider.', 'noonfy' ) );
		}

		$host = strtolower( trim( (string) $get( 'host' ) ) );
		if ( ! preg_match( '/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/', $host ) ) {
			return $err( __( 'Enter a valid SMTP host, e.g. smtp.example.com.', 'noonfy' ) );
		}

		$port = (int) $get( 'port' );
		if ( $port < 1 || $port > 65535 ) {
			return $err( __( 'Port must be between 1 and 65535.', 'noonfy' ) );
		}

		$encryption = (string) $get( 'encryption' );
		if ( ! in_array( $encryption, self::ENCRYPTION, true ) ) {
			return $err( __( 'Encryption must be None, SSL or TLS.', 'noonfy' ) );
		}

		$from_email = sanitize_email( (string) $get( 'fromEmail' ) );
		if ( '' !== trim( (string) $get( 'fromEmail' ) ) && ! is_email( $from_email ) ) {
			return $err( __( 'From email is not a valid address.', 'noonfy' ) );
		}

		$name = sanitize_text_field( (string) $get( 'name' ) );

		$out = array(
			'provider'   => $provider,
			'name'       => '' !== $name ? $name : $preset['label'],
			'host'       => $host,
			'port'       => $port,
			'encryption' => $encryption,
			'username'   => '' !== $preset['username'] ? $preset['username'] : sanitize_text_field( (string) $get( 'username' ) ),
			'fromEmail'  => $from_email,
			'fromName'   => sanitize_text_field( (string) $get( 'fromName' ) ),
			'priority'   => max( 1, min( 99, (int) $get( 'priority' ) ) ),
			'weight'     => max( 0, min( 100, (int) $get( 'weight' ) ) ),
			'dailyLimit' => max( 0, (int) $get( 'dailyLimit' ) ),
			'enabled'    => rest_sanitize_boolean( $get( 'enabled' ) ),
			'password'   => $base['password'],
		);

		// Passwords are stored as typed (no text sanitising, which would alter special characters).
		if ( isset( $in['password'] ) && is_string( $in['password'] ) && '' !== $in['password'] ) {
			if ( strlen( $in['password'] ) > 2048 ) {
				return $err( __( 'Password is too long.', 'noonfy' ) );
			}
			$out['password'] = Noonfy_Crypto::encrypt( $in['password'] );
		}

		return $out;
	}
}
