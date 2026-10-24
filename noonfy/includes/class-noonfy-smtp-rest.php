<?php
/**
 * REST API for the SMTP screen.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Routes under /wp-json/noonfy/v1/smtp. All require the `manage_woocommerce` capability.
 */
class Noonfy_SMTP_REST {

	const NS = 'noonfy/v1';

	/** Hooks the route registration. */
	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	/** Registers the routes. */
	public static function register_routes() {
		register_rest_route(
			self::NS,
			'/smtp/settings',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( __CLASS__, 'get_settings' ),
					'permission_callback' => array( __CLASS__, 'can_manage' ),
				),
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( __CLASS__, 'update_settings' ),
					'permission_callback' => array( __CLASS__, 'can_manage' ),
				),
			)
		);

		register_rest_route(
			self::NS,
			'/smtp/test-email',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'send_test_email' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
			)
		);
	}

	/** @return bool */
	public static function can_manage() {
		return current_user_can( 'manage_woocommerce' );
	}

	/** @return WP_REST_Response */
	public static function get_settings() {
		return rest_ensure_response( Noonfy_SMTP_Settings::get() );
	}

	/**
	 * Partial update: only the keys sent are changed.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_settings( WP_REST_Request $request ) {
		$patch = $request->get_json_params();
		if ( ! is_array( $patch ) ) {
			return new WP_Error( 'noonfy_bad_request', __( 'Expected a JSON object.', 'noonfy' ), array( 'status' => 400 ) );
		}
		$allowed = array_keys( Noonfy_SMTP_Settings::defaults() );
		$result  = Noonfy_SMTP_Settings::update( array_intersect_key( $patch, array_flip( $allowed ) ) );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	/**
	 * Sends a test message to the current user with wp_mail(), using the saved default sender.
	 *
	 * A true return only means the site's mailer accepted the message, not that it was delivered.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function send_test_email() {
		$user = wp_get_current_user();
		$to   = $user->user_email;
		if ( ! is_email( $to ) ) {
			return new WP_Error( 'noonfy_no_recipient', __( 'Your user account has no valid email address.', 'noonfy' ), array( 'status' => 400 ) );
		}

		$settings = Noonfy_SMTP_Settings::get();
		$headers  = array( 'Content-Type: text/plain; charset=UTF-8' );
		if ( is_email( $settings['fromEmail'] ) ) {
			$name      = str_replace( array( '"', "\r", "\n" ), '', $settings['fromName'] );
			$headers[] = '' !== $name ? sprintf( 'From: "%s" <%s>', $name, $settings['fromEmail'] ) : 'From: ' . $settings['fromEmail'];
		}

		$error   = null;
		$capture = static function ( $wp_error ) use ( &$error ) {
			$error = $wp_error;
		};
		add_action( 'wp_mail_failed', $capture );

		$sent = wp_mail(
			$to,
			/* translators: %s: site name */
			sprintf( __( '[%s] Noonfy test email', 'noonfy' ), wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ) ),
			__( "This is a test message from Noonfy's SMTP & Email Delivery screen.\n\nIf you can read this, your site can send email.", 'noonfy' ),
			$headers
		);

		remove_action( 'wp_mail_failed', $capture );

		if ( ! $sent ) {
			$message = $error instanceof WP_Error ? $error->get_error_message() : __( 'wp_mail() could not send the message.', 'noonfy' );
			return new WP_Error( 'noonfy_mail_failed', $message, array( 'status' => 500 ) );
		}

		return rest_ensure_response( array( 'to' => $to ) );
	}
}
