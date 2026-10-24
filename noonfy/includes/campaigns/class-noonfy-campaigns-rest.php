<?php
/**
 * REST API for campaigns.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Routes under /wp-json/noonfy/v1/campaigns. All require `manage_woocommerce`.
 */
class Noonfy_Campaigns_REST {

	const NS = 'noonfy/v1';

	/** Hooks the route registration. */
	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	/** Registers the routes. */
	public static function register_routes() {
		$route = static function ( $path, $methods, $callback ) {
			register_rest_route(
				self::NS,
				'/campaigns' . $path,
				array(
					'methods'             => $methods,
					'callback'            => array( __CLASS__, $callback ),
					'permission_callback' => static function () {
						return current_user_can( 'manage_woocommerce' );
					},
				)
			);
		};
		$id = '/(?P<id>\d+)';

		$route( '', WP_REST_Server::READABLE, 'index' );
		$route( '', WP_REST_Server::CREATABLE, 'create' );
		$route( '/settings', WP_REST_Server::READABLE, 'get_settings' );
		$route( '/settings', WP_REST_Server::CREATABLE, 'save_settings' );
		$route( '/products', WP_REST_Server::READABLE, 'products' );
		$route( '/preview', WP_REST_Server::CREATABLE, 'preview' );
		$route( '/test', WP_REST_Server::CREATABLE, 'test' );
		$route( '/contacts/sync', WP_REST_Server::CREATABLE, 'sync_contacts' );
		$route( $id, WP_REST_Server::READABLE, 'show' );
		$route( $id, WP_REST_Server::EDITABLE, 'update' );
		$route( $id, WP_REST_Server::DELETABLE, 'delete' );
		$route( $id . '/duplicate', WP_REST_Server::CREATABLE, 'duplicate' );
		$route( $id . '/send', WP_REST_Server::CREATABLE, 'send' );
		$route( $id . '/pause', WP_REST_Server::CREATABLE, 'pause' );
		$route( $id . '/resume', WP_REST_Server::CREATABLE, 'resume' );
		$route( $id . '/cancel', WP_REST_Server::CREATABLE, 'cancel' );
		$route( $id . '/winner', WP_REST_Server::CREATABLE, 'winner' );
	}

	/**
	 * Everything the list screen needs. Also nudges due/overdue sending (see Noonfy_Campaign_Sender::tick).
	 *
	 * @return WP_REST_Response
	 */
	public static function index() {
		Noonfy_Campaign_Sender::tick();
		return rest_ensure_response( self::overview() );
	}

	/** @return array Campaigns, segments, contact summary and readiness. */
	public static function overview() {
		return array(
			'campaigns' => Noonfy_Campaigns::all_public(),
			'segments'  => Noonfy_Contacts::segments(),
			'summary'   => Noonfy_Contacts::summary(),
			'smtpReady' => Noonfy_Mailer::is_routing_active(),
		);
	}

	/**
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create( WP_REST_Request $r ) {
		return rest_ensure_response( Noonfy_Campaigns::create( (array) $r->get_json_params() ) );
	}

	/**
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function show( WP_REST_Request $r ) {
		$c = Noonfy_Campaigns::get_public( (int) $r['id'] );
		return $c ? rest_ensure_response( $c ) : new WP_Error( 'noonfy_not_found', __( 'Campaign not found.', 'noonfy' ), array( 'status' => 404 ) );
	}

	/**
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update( WP_REST_Request $r ) {
		return rest_ensure_response( Noonfy_Campaigns::update( (int) $r['id'], (array) $r->get_json_params() ) );
	}

	/**
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function delete( WP_REST_Request $r ) {
		$result = Noonfy_Campaigns::delete( (int) $r['id'] );
		return is_wp_error( $result ) ? $result : rest_ensure_response( array( 'deleted' => true ) );
	}

	/**
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function duplicate( WP_REST_Request $r ) {
		return rest_ensure_response( Noonfy_Campaigns::duplicate( (int) $r['id'] ) );
	}

	/**
	 * Sends now, or schedules when `scheduledAt` (ISO 8601) is in the future.
	 *
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function send( WP_REST_Request $r ) {
		$at   = (string) $r->get_param( 'scheduledAt' );
		$when = '' !== $at ? strtotime( $at ) : null;
		if ( '' !== $at && ! $when ) {
			return new WP_Error( 'noonfy_bad_date', __( 'Invalid send time.', 'noonfy' ), array( 'status' => 400 ) );
		}
		return rest_ensure_response( Noonfy_Campaign_Sender::schedule( (int) $r['id'], $when ) );
	}

	/**
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function pause( WP_REST_Request $r ) {
		return rest_ensure_response( Noonfy_Campaign_Sender::pause( (int) $r['id'] ) );
	}

	/**
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function resume( WP_REST_Request $r ) {
		return rest_ensure_response( Noonfy_Campaign_Sender::resume( (int) $r['id'] ) );
	}

	/**
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function cancel( WP_REST_Request $r ) {
		return rest_ensure_response( Noonfy_Campaign_Sender::cancel( (int) $r['id'] ) );
	}

	/**
	 * Ends an A/B test now: `variant` A or B, or empty to pick by the campaign's metric.
	 *
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function winner( WP_REST_Request $r ) {
		$v = strtoupper( (string) $r->get_param( 'variant' ) );
		return rest_ensure_response( Noonfy_Campaign_Sender::decide( (int) $r['id'], in_array( $v, array( 'A', 'B' ), true ) ? $v : null ) );
	}

	/**
	 * Rendered HTML of (possibly unsaved) campaign content, as the first recipient would see it.
	 *
	 * @param WP_REST_Request $r Request with subject, preheader, content.
	 * @return WP_REST_Response
	 */
	public static function preview( WP_REST_Request $r ) {
		$params = (array) $r->get_json_params();
		$html   = Noonfy_Email_Renderer::render(
			Noonfy_Campaign_Sender::with_ab( $params, strtoupper( (string) ( $params['variant'] ?? 'A' ) ) ),
			array(
				'contact'         => Noonfy_Campaign_Sender::admin_contact( wp_get_current_user()->user_email ),
				'unsubscribe_url' => '#',
			)
		);
		return rest_ensure_response( array( 'html' => $html ) );
	}

	/**
	 * @param WP_REST_Request $r Request with campaign fields and `to`.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function test( WP_REST_Request $r ) {
		$params = (array) $r->get_json_params();
		$to     = ! empty( $params['to'] ) ? sanitize_email( $params['to'] ) : wp_get_current_user()->user_email;
		$result = Noonfy_Campaign_Sender::send_test( $params, $to, strtoupper( (string) ( $params['variant'] ?? 'A' ) ) );
		return is_wp_error( $result ) ? $result : rest_ensure_response( array( 'to' => $to ) );
	}

	/**
	 * Product search for the products block (`search`), or lookup by `ids` (comma separated).
	 *
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response
	 */
	public static function products( WP_REST_Request $r ) {
		if ( ! function_exists( 'wc_get_products' ) ) {
			return rest_ensure_response( array() );
		}
		$ids = array_filter( array_map( 'absint', explode( ',', (string) $r->get_param( 'ids' ) ) ) );
		if ( ! $ids ) {
			$ids = wc_get_products(
				array(
					'status' => 'publish',
					'limit'  => 12,
					's'      => sanitize_text_field( (string) $r->get_param( 'search' ) ),
					'return' => 'ids',
				)
			);
		}
		return rest_ensure_response( Noonfy_Email_Renderer::product_data( array_map( 'intval', (array) $ids ) ) );
	}

	/** @return WP_REST_Response */
	public static function get_settings() {
		return rest_ensure_response( Noonfy_Campaign_Settings::get() );
	}

	/**
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response
	 */
	public static function save_settings( WP_REST_Request $r ) {
		$settings = Noonfy_Campaign_Settings::update( (array) $r->get_json_params() );
		return rest_ensure_response( array( 'settings' => $settings ) + self::overview() );
	}

	/**
	 * One page of the WooCommerce customer sync. `subscribe` marks customers as subscribed and
	 * requires `consent` = true (the store confirms it has their permission).
	 *
	 * @param WP_REST_Request $r Request with page, subscribe, consent.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function sync_contacts( WP_REST_Request $r ) {
		$subscribe = rest_sanitize_boolean( $r->get_param( 'subscribe' ) );
		if ( $subscribe && ! rest_sanitize_boolean( $r->get_param( 'consent' ) ) ) {
			return new WP_Error( 'noonfy_consent', __( 'Confirm that these customers agreed to receive marketing email.', 'noonfy' ), array( 'status' => 400 ) );
		}
		if ( ! function_exists( 'wc_get_orders' ) ) {
			return new WP_Error( 'noonfy_no_woo', __( 'WooCommerce is not active.', 'noonfy' ), array( 'status' => 400 ) );
		}
		$result = Noonfy_Contacts::sync_customers( max( 1, (int) $r->get_param( 'page' ) ), $subscribe );
		return rest_ensure_response( $result + ( $result['done'] ? self::overview() : array() ) );
	}
}
