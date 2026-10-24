<?php
/**
 * REST API for automations.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Routes under /wp-json/noonfy/v1/automations. All require `manage_woocommerce`.
 */
class Noonfy_Automations_REST {

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
				'/automations' . $path,
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
		$route( '/templates', WP_REST_Server::READABLE, 'templates' );
		$route( '/journeys', WP_REST_Server::READABLE, 'journeys' );
		$route( '/settings', WP_REST_Server::CREATABLE, 'save_settings' );
		$route( '/preview', WP_REST_Server::CREATABLE, 'preview' );
		$route( '/test', WP_REST_Server::CREATABLE, 'test' );
		$route( $id, WP_REST_Server::READABLE, 'show' );
		$route( $id, WP_REST_Server::EDITABLE, 'update' );
		$route( $id, WP_REST_Server::DELETABLE, 'delete' );
		$route( $id . '/duplicate', WP_REST_Server::CREATABLE, 'duplicate' );
		$route( $id . '/activate', WP_REST_Server::CREATABLE, 'activate' );
		$route( $id . '/pause', WP_REST_Server::CREATABLE, 'pause' );
		$route( $id . '/enrol', WP_REST_Server::CREATABLE, 'enrol' );
		$route( $id . '/enrollments/(?P<eid>\d+)/remove', WP_REST_Server::CREATABLE, 'remove_enrollment' );
	}

	/**
	 * Workflow list. Also does overdue automation work (see Noonfy_Automation_Runner::tick).
	 *
	 * @return WP_REST_Response
	 */
	public static function index() {
		Noonfy_Automation_Runner::tick();
		return rest_ensure_response( self::overview() );
	}

	/** @return array Workflows, segments, settings and readiness. */
	public static function overview() {
		return array(
			'workflows' => Noonfy_Workflows::all_public(),
			'segments'  => Noonfy_Contacts::segments(),
			'settings'  => Noonfy_Automation_Settings::get(),
			'smtpReady' => Noonfy_Mailer::is_routing_active(),
		);
	}

	/**
	 * New workflow: from `template`, or blank.
	 *
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create( WP_REST_Request $r ) {
		$params = (array) $r->get_json_params();
		if ( ! empty( $params['template'] ) ) {
			$template = Noonfy_Automation_Templates::get( sanitize_key( $params['template'] ) );
			if ( ! $template ) {
				return new WP_Error( 'noonfy_no_template', __( 'This template isn’t available yet.', 'noonfy' ), array( 'status' => 400 ) );
			}
			$params = $template + array( 'template' => $params['template'] );
		}
		return rest_ensure_response( Noonfy_Workflows::create( $params ) );
	}

	/**
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error Workflow with per-step stats and recent contacts.
	 */
	public static function show( WP_REST_Request $r ) {
		$id = (int) $r['id'];
		$wf = Noonfy_Workflows::get_public( $id );
		if ( ! $wf ) {
			return new WP_Error( 'noonfy_not_found', __( 'Workflow not found.', 'noonfy' ), array( 'status' => 404 ) );
		}
		return rest_ensure_response(
			$wf + array(
				'nodeStats' => Noonfy_Workflows::node_stats( $id ),
				'contacts'  => Noonfy_Workflows::recent_enrollments( $id ),
			)
		);
	}

	/**
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update( WP_REST_Request $r ) {
		return rest_ensure_response( Noonfy_Workflows::update( (int) $r['id'], (array) $r->get_json_params() ) );
	}

	/**
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function delete( WP_REST_Request $r ) {
		$result = Noonfy_Workflows::delete( (int) $r['id'] );
		return is_wp_error( $result ) ? $result : rest_ensure_response( array( 'deleted' => true ) );
	}

	/**
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function duplicate( WP_REST_Request $r ) {
		return rest_ensure_response( Noonfy_Workflows::duplicate( (int) $r['id'] ) );
	}

	/**
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function activate( WP_REST_Request $r ) {
		return rest_ensure_response( Noonfy_Workflows::set_status( (int) $r['id'], 'live' ) );
	}

	/**
	 * Pausing holds everyone where they are; they continue when the workflow is activated again.
	 *
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function pause( WP_REST_Request $r ) {
		return rest_ensure_response( Noonfy_Workflows::set_status( (int) $r['id'], 'paused' ) );
	}

	/**
	 * Segment workflows: enroll segment members who aren't in it yet.
	 *
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function enrol( WP_REST_Request $r ) {
		$added = Noonfy_Automation_Triggers::enrol_segment( (int) $r['id'] );
		return is_wp_error( $added ) ? $added : rest_ensure_response( array( 'enrolled' => $added ) );
	}

	/**
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response
	 */
	public static function remove_enrollment( WP_REST_Request $r ) {
		return rest_ensure_response( array( 'removed' => Noonfy_Automation_Runner::remove( (int) $r['eid'] ) ) );
	}

	/** @return WP_REST_Response Template gallery. */
	public static function templates() {
		return rest_ensure_response(
			array(
				'categories' => Noonfy_Automation_Templates::CATEGORIES,
				'templates'  => Noonfy_Automation_Templates::all(),
			)
		);
	}

	/**
	 * Journey analytics: for each workflow that has enrolled anyone, how many reached each email and
	 * how many converted.
	 *
	 * @return WP_REST_Response
	 */
	public static function journeys() {
		$out = array();
		foreach ( Noonfy_Workflows::all_public() as $wf ) {
			if ( ! $wf['stats']['enrolled'] ) {
				continue;
			}
			$stats   = Noonfy_Workflows::node_stats( $wf['id'] );
			$trigger = Noonfy_Workflows::trigger_node( $wf['graph'] );
			$steps   = array();
			foreach ( Noonfy_Automation_Runner::emails_in_order( $wf['graph'] ) as $node ) {
				$steps[] = array(
					'nodeId' => $node['id'],
					'name'   => $node['name'],
					'sent'   => $stats['emails'][ $node['id'] ]['sent'] ?? 0,
				);
			}
			$out[] = array(
				'id'        => $wf['id'],
				'name'      => $wf['name'],
				'emoji'     => $wf['emoji'],
				'status'    => $wf['status'],
				'entered'   => $trigger ? ( $stats['events'][ $trigger['id'] ]['enter'] ?? 0 ) : 0,
				'completed' => $wf['stats']['completed'],
				'converted' => $wf['stats']['converted'],
				'active'    => $wf['stats']['active'],
				'emails'    => $steps,
				'dropoffs'  => self::dropoffs( $wf['id'], array_column( $steps, 'nodeId' ) ),
			);
		}
		return rest_ensure_response( $out );
	}

	/**
	 * Contacts who left a workflow without converting, by the last email they got: index -1 = left
	 * before the first email. Contacts still in the workflow, and those who finished after the last
	 * email, aren't drop-offs.
	 *
	 * @param int      $id     Workflow id.
	 * @param string[] $emails Email node ids in flow order.
	 * @return object Email index => contacts.
	 */
	private static function dropoffs( $id, array $emails ) {
		global $wpdb;
		$en = Noonfy_Workflows::enrollments_table();
		$se = Noonfy_Workflows::sends_table();
		// phpcs:ignore WordPress.DB
		$rows  = $wpdb->get_col( $wpdb->prepare( "SELECT GROUP_CONCAT(DISTINCT s.node_id) FROM {$en} e LEFT JOIN {$se} s ON s.enrollment_id = e.id AND s.status = 'sent' WHERE e.workflow_id = %d AND e.status <> 'active' AND e.converted_at IS NULL GROUP BY e.id", $id ) );
		$index = array_flip( $emails );
		$out   = array();
		foreach ( (array) $rows as $nodes ) {
			$last = -1;
			foreach ( array_filter( explode( ',', (string) $nodes ) ) as $node ) {
				$last = max( $last, $index[ $node ] ?? -1 );
			}
			if ( $last < count( $emails ) - 1 ) {
				$out[ $last ] = ( $out[ $last ] ?? 0 ) + 1;
			}
		}
		return (object) $out;
	}

	/**
	 * @param WP_REST_Request $r Request.
	 * @return WP_REST_Response
	 */
	public static function save_settings( WP_REST_Request $r ) {
		return rest_ensure_response( Noonfy_Automation_Settings::update( (array) $r->get_json_params() ) );
	}

	/**
	 * Rendered HTML of one email step, with the store's newest products standing in for dynamic ones.
	 *
	 * @param WP_REST_Request $r Request with subject, preheader, content.
	 * @return WP_REST_Response
	 */
	public static function preview( WP_REST_Request $r ) {
		$params = (array) $r->get_json_params();
		$html   = Noonfy_Email_Renderer::render(
			array(
				'subject'   => (string) ( $params['subject'] ?? '' ),
				'preheader' => (string) ( $params['preheader'] ?? '' ),
				'content'   => $params['content'] ?? array(),
			),
			array(
				'contact'         => Noonfy_Campaign_Sender::admin_contact( wp_get_current_user()->user_email ),
				'unsubscribe_url' => '#',
			) + Noonfy_Automation_Runner::sample_dynamic()
		);
		return rest_ensure_response( array( 'html' => $html ) );
	}

	/**
	 * Test run: every email of the (unsaved) graph, or just `nodeId`, to `to`.
	 *
	 * @param WP_REST_Request $r Request with graph, to, nodeId.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function test( WP_REST_Request $r ) {
		$params = (array) $r->get_json_params();
		$to     = ! empty( $params['to'] ) ? sanitize_email( $params['to'] ) : wp_get_current_user()->user_email;
		$graph  = Noonfy_Workflows::sanitize_graph( $params['graph'] ?? array() );
		if ( ! empty( $params['nodeId'] ) ) {
			$node           = Noonfy_Workflows::node( $graph, (string) $params['nodeId'] );
			$graph['nodes'] = $node ? array( $node ) : array();
		}
		$sent = Noonfy_Automation_Runner::test_run( $graph, $to );
		return is_wp_error( $sent ) ? $sent : rest_ensure_response( array( 'to' => $to, 'sent' => $sent ) );
	}
}
