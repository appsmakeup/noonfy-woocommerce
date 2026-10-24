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

		$route = static function ( $path, $methods, $callback ) {
			register_rest_route(
				self::NS,
				$path,
				array(
					'methods'             => $methods,
					'callback'            => array( __CLASS__, $callback ),
					'permission_callback' => array( __CLASS__, 'can_manage' ),
				)
			);
		};
		$id = '(?P<id>c_[a-z0-9]+)';

		$route( '/smtp/connections', WP_REST_Server::READABLE, 'list_connections' );
		$route( '/smtp/connections', WP_REST_Server::CREATABLE, 'create_connection' );
		$route( '/smtp/connections/test', WP_REST_Server::CREATABLE, 'test_connection_config' );
		$route( "/smtp/connections/{$id}", WP_REST_Server::EDITABLE, 'update_connection' );
		$route( "/smtp/connections/{$id}", WP_REST_Server::DELETABLE, 'delete_connection' );
		$route( "/smtp/connections/{$id}/test", WP_REST_Server::CREATABLE, 'test_connection' );
		$route( '/smtp/stats', WP_REST_Server::READABLE, 'get_stats' );
		$route( '/smtp/logs', WP_REST_Server::READABLE, 'get_logs' );
	}

	/** @return WP_REST_Response */
	public static function list_connections() {
		return rest_ensure_response( Noonfy_Connections::all_public() );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_connection( WP_REST_Request $request ) {
		return rest_ensure_response( Noonfy_Connections::create( (array) $request->get_json_params() ) );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_connection( WP_REST_Request $request ) {
		return rest_ensure_response( Noonfy_Connections::update( $request['id'], (array) $request->get_json_params() ) );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function delete_connection( WP_REST_Request $request ) {
		if ( ! Noonfy_Connections::delete( $request['id'] ) ) {
			return new WP_Error( 'noonfy_not_found', __( 'Connection not found.', 'noonfy' ), array( 'status' => 404 ) );
		}
		return rest_ensure_response( array( 'deleted' => true ) );
	}

	/**
	 * Tests a saved connection and remembers the result.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function test_connection( WP_REST_Request $request ) {
		$conn = Noonfy_Connections::get( $request['id'] );
		if ( ! $conn ) {
			return new WP_Error( 'noonfy_not_found', __( 'Connection not found.', 'noonfy' ), array( 'status' => 404 ) );
		}
		$result = Noonfy_Mailer::test_smtp( Noonfy_Connections::smtp_config( $conn ) );
		Noonfy_Connections::record_test( $conn['id'], $result['ok'], $result['latencyMs'], $result['error'] );
		return rest_ensure_response( $result );
	}

	/**
	 * Tests unsaved form values. With an `id`, a blank password means "use the saved one".
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function test_connection_config( WP_REST_Request $request ) {
		$input    = (array) $request->get_json_params();
		$existing = ! empty( $input['id'] ) ? Noonfy_Connections::get( (string) $input['id'] ) : null;
		$conn     = Noonfy_Connections::sanitize( $input, $existing );
		if ( is_wp_error( $conn ) ) {
			return $conn;
		}
		return rest_ensure_response( Noonfy_Mailer::test_smtp( Noonfy_Connections::smtp_config( $conn ) ) );
	}

	/** @return WP_REST_Response */
	public static function get_stats() {
		return rest_ensure_response( Noonfy_Email_Log::stats() );
	}

	/**
	 * @param WP_REST_Request $request Request with optional status, connectionId, search, before, after, limit.
	 * @return WP_REST_Response
	 */
	public static function get_logs( WP_REST_Request $request ) {
		return rest_ensure_response(
			Noonfy_Email_Log::query(
				array(
					'status'       => (string) $request->get_param( 'status' ),
					'connectionId' => (string) $request->get_param( 'connectionId' ),
					'search'       => (string) $request->get_param( 'search' ),
					'before'       => (int) $request->get_param( 'before' ),
					'after'        => (int) $request->get_param( 'after' ),
					'limit'        => (int) ( $request->get_param( 'limit' ) ? $request->get_param( 'limit' ) : 25 ),
				)
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
	 * Sends a test message to the current user with wp_mail(): through normal routing, or through one
	 * connection when `connectionId` is given. Success means the mail server accepted the message.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function send_test_email( WP_REST_Request $request ) {
		$connection_id = (string) $request->get_param( 'connectionId' );
		$connection    = '' !== $connection_id ? Noonfy_Connections::get( $connection_id ) : null;
		if ( '' !== $connection_id && ! $connection ) {
			return new WP_Error( 'noonfy_not_found', __( 'Connection not found.', 'noonfy' ), array( 'status' => 404 ) );
		}

		$user = wp_get_current_user();
		$to   = $user->user_email;
		if ( ! is_email( $to ) ) {
			return new WP_Error( 'noonfy_no_recipient', __( 'Your user account has no valid email address.', 'noonfy' ), array( 'status' => 400 ) );
		}

		// The sender comes from the connection or the default-sender settings (see Noonfy_Mailer).
		$headers = array( 'Content-Type: text/plain; charset=UTF-8' );

		$error   = null;
		$capture = static function ( $wp_error ) use ( &$error ) {
			$error = $wp_error;
		};
		add_action( 'wp_mail_failed', $capture );
		Noonfy_Mailer::force_connection( $connection );

		$sent = wp_mail(
			$to,
			/* translators: %s: site name */
			sprintf( __( '[%s] Noonfy test email', 'noonfy' ), wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ) ),
			__( "This is a test message from Noonfy's SMTP & Email Delivery screen.\n\nIf you can read this, your site can send email.", 'noonfy' ),
			$headers
		);

		remove_action( 'wp_mail_failed', $capture );
		Noonfy_Mailer::force_connection( null );

		if ( ! $sent ) {
			$message = $error instanceof WP_Error ? $error->get_error_message() : __( 'wp_mail() could not send the message.', 'noonfy' );
			return new WP_Error( 'noonfy_mail_failed', $message, array( 'status' => 500 ) );
		}

		return rest_ensure_response(
			array(
				'to'  => $to,
				'via' => $connection ? $connection['name'] : ( Noonfy_Mailer::is_routing_active() ? __( 'your connections', 'noonfy' ) : __( 'PHP mail()', 'noonfy' ) ),
			)
		);
	}
}
