<?php
/**
 * Automation workflows: storage, graph validation and stats.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * A workflow is a graph of steps (nodes) joined by edges, edited in the visual builder.
 *
 * Node: { id, kind, name, x, y, settings }. Edge: { from, to, port }. Branching kinds have two ports
 * (condition and wait: yes/no, split: a/b); every other kind has a single 'out' port. A workflow is
 * started by its one trigger node; Noonfy_Automation_Runner moves each enrolled contact through it.
 *
 * Tables:
 * - workflows: the graph and status (draft, live, paused).
 * - enrollments: one contact's trip through a workflow (current step, when it next runs).
 * - sends: one automation email to one contact, with opens, clicks and attributed revenue.
 * - events: every step a contact entered (and which branch it took) — the per-step stats and funnels.
 */
class Noonfy_Workflows {

	const STATUSES = array( 'draft', 'live', 'paused' );
	const KINDS    = array( 'trigger', 'delay', 'email', 'condition', 'wait', 'split', 'goal', 'exit' );
	const PORTS    = array(
		'condition' => array( 'yes', 'no' ),
		'wait'      => array( 'yes', 'no' ),
		'split'     => array( 'a', 'b' ),
		'exit'      => array(),
	);
	const TRIGGERS = array( 'subscribed', 'order_paid', 'order_completed', 'no_order', 'lifetime_spend', 'cart_abandoned', 'browse_abandoned', 'segment' );
	const CHECKS   = array( 'opened', 'clicked', 'ordered', 'spent', 'orders', 'subscribed' );
	const EVENTS   = array( 'ordered', 'opened', 'clicked' );
	const UNITS    = array( 'minutes', 'hours', 'days' );
	const EMOJIS   = array( '⚡', '👋', '🛒', '👀', '🎉', '🎁', '📈', '💫', '👑', '⭐', '💎', '😴', '🥂', '🍂', '🚀', '✨', '🏆', '🧺', '🚚', '📬', '📝', '🎄', '🕶️', '💳', '📦' );

	/** @var array<string, array[]> live_by_trigger() cache for this request. */
	private static $live = array();

	/** Triggers that let a contact enter again (for a new order, cart, lapse…) once their last trip ended. */
	const REPEATABLE = array( 'order_paid', 'order_completed', 'no_order', 'cart_abandoned', 'browse_abandoned' );

	/** @return string */
	public static function table() {
		global $wpdb;
		return $wpdb->prefix . 'noonfy_workflows';
	}

	/** @return string */
	public static function enrollments_table() {
		global $wpdb;
		return $wpdb->prefix . 'noonfy_enrollments';
	}

	/** @return string */
	public static function sends_table() {
		global $wpdb;
		return $wpdb->prefix . 'noonfy_automation_sends';
	}

	/** @return string */
	public static function events_table() {
		global $wpdb;
		return $wpdb->prefix . 'noonfy_automation_events';
	}

	/** Creates or upgrades the tables (called by Noonfy_Install). */
	public static function create_tables() {
		global $wpdb;
		$charset = $wpdb->get_charset_collate();
		$wf      = self::table();
		$en      = self::enrollments_table();
		$se      = self::sends_table();
		$ev      = self::events_table();
		dbDelta(
			"CREATE TABLE {$wf} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				name varchar(190) NOT NULL DEFAULT '',
				emoji varchar(16) NOT NULL DEFAULT '',
				status varchar(10) NOT NULL DEFAULT 'draft',
				trigger_type varchar(20) NOT NULL DEFAULT '',
				template varchar(40) NOT NULL DEFAULT '',
				graph longtext NOT NULL,
				activated_at datetime DEFAULT NULL,
				created_at datetime NOT NULL,
				updated_at datetime NOT NULL,
				PRIMARY KEY  (id),
				KEY status_trigger (status, trigger_type)
			) {$charset};"
		);
		dbDelta(
			"CREATE TABLE {$en} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				workflow_id bigint(20) unsigned NOT NULL,
				contact_id bigint(20) unsigned NOT NULL,
				email varchar(190) NOT NULL,
				ref varchar(64) NOT NULL DEFAULT '',
				status varchar(10) NOT NULL DEFAULT 'active',
				node_id varchar(20) NOT NULL DEFAULT '',
				next_run_at datetime DEFAULT NULL,
				context longtext,
				exit_reason varchar(20) NOT NULL DEFAULT '',
				entered_at datetime NOT NULL,
				updated_at datetime NOT NULL,
				finished_at datetime DEFAULT NULL,
				converted_at datetime DEFAULT NULL,
				revenue decimal(14,2) NOT NULL DEFAULT 0,
				PRIMARY KEY  (id),
				UNIQUE KEY workflow_contact_ref (workflow_id, contact_id, ref),
				KEY due (status, next_run_at),
				KEY contact_status (contact_id, status)
			) {$charset};"
		);
		dbDelta(
			"CREATE TABLE {$se} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				workflow_id bigint(20) unsigned NOT NULL,
				enrollment_id bigint(20) unsigned NOT NULL,
				node_id varchar(20) NOT NULL DEFAULT '',
				contact_id bigint(20) unsigned NOT NULL,
				email varchar(190) NOT NULL,
				status varchar(10) NOT NULL DEFAULT 'sent',
				sent_at datetime DEFAULT NULL,
				opened_at datetime DEFAULT NULL,
				open_count int(10) unsigned NOT NULL DEFAULT 0,
				clicked_at datetime DEFAULT NULL,
				click_count int(10) unsigned NOT NULL DEFAULT 0,
				order_id bigint(20) unsigned NOT NULL DEFAULT 0,
				revenue decimal(14,2) NOT NULL DEFAULT 0,
				error varchar(255) NOT NULL DEFAULT '',
				PRIMARY KEY  (id),
				KEY workflow_node (workflow_id, node_id),
				KEY enrollment (enrollment_id),
				KEY email_sent (email, sent_at)
			) {$charset};"
		);
		dbDelta(
			"CREATE TABLE {$ev} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				workflow_id bigint(20) unsigned NOT NULL,
				enrollment_id bigint(20) unsigned NOT NULL,
				node_id varchar(20) NOT NULL DEFAULT '',
				action varchar(8) NOT NULL DEFAULT 'enter',
				created_at datetime NOT NULL,
				PRIMARY KEY  (id),
				KEY workflow_node (workflow_id, node_id, action),
				KEY enrollment (enrollment_id)
			) {$charset};"
		);
	}

	/**
	 * @param int $id Workflow id.
	 * @return array|null Row with decoded graph.
	 */
	public static function get( $id ) {
		global $wpdb;
		$table = self::table();
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", (int) $id ), ARRAY_A ); // phpcs:ignore WordPress.DB
		return $row ? self::decode( $row ) : null;
	}

	/**
	 * @param array $row DB row.
	 * @return array
	 */
	private static function decode( array $row ) {
		$graph        = json_decode( (string) $row['graph'], true );
		$row['graph'] = is_array( $graph ) ? $graph : array( 'nodes' => array(), 'edges' => array() );
		return $row;
	}

	/**
	 * @param string $trigger Trigger type.
	 * @return array[] Live workflows started by this trigger.
	 */
	public static function live_by_trigger( $trigger ) {
		global $wpdb;
		if ( ! isset( self::$live[ $trigger ] ) ) {
			$table                  = self::table();
			$rows                   = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} WHERE status = 'live' AND trigger_type = %s", $trigger ), ARRAY_A ); // phpcs:ignore WordPress.DB
			self::$live[ $trigger ] = array_map( array( __CLASS__, 'decode' ), (array) $rows );
		}
		return self::$live[ $trigger ];
	}

	/**
	 * Trigger types that have at least one live workflow — kept in an autoloaded option so storefront
	 * requests can skip cart and product-view tracking cheaply when nothing would use it.
	 *
	 * @return string[]
	 */
	public static function live_triggers() {
		return (array) get_option( 'noonfy_live_triggers', array() );
	}

	/** Rebuilds the live_triggers() option. */
	public static function refresh_live_triggers() {
		global $wpdb;
		self::$live = array();
		$table = self::table();
		update_option( 'noonfy_live_triggers', array_values( (array) $wpdb->get_col( "SELECT DISTINCT trigger_type FROM {$table} WHERE status = 'live'" ) ), true ); // phpcs:ignore WordPress.DB
	}

	/**
	 * @param array $graph Graph.
	 * @return array|null The trigger node.
	 */
	public static function trigger_node( array $graph ) {
		foreach ( $graph['nodes'] as $n ) {
			if ( 'trigger' === $n['kind'] ) {
				return $n;
			}
		}
		return null;
	}

	/**
	 * @param array  $graph Graph.
	 * @param string $id    Node id.
	 * @return array|null
	 */
	public static function node( array $graph, $id ) {
		foreach ( $graph['nodes'] as $n ) {
			if ( $n['id'] === $id ) {
				return $n;
			}
		}
		return null;
	}

	/**
	 * @param array  $graph Graph.
	 * @param string $from  Node id.
	 * @param string $port  Port.
	 * @return array|null Target node.
	 */
	public static function next_node( array $graph, $from, $port ) {
		foreach ( $graph['edges'] as $e ) {
			if ( $e['from'] === $from && $e['port'] === $port ) {
				return self::node( $graph, $e['to'] );
			}
		}
		return null;
	}

	/** @return array[] All workflows (browser shape, with stats). */
	public static function all_public() {
		global $wpdb;
		$table = self::table();
		$rows  = $wpdb->get_results( "SELECT * FROM {$table} ORDER BY FIELD(status, 'live', 'paused', 'draft'), updated_at DESC, id DESC", ARRAY_A ); // phpcs:ignore WordPress.DB
		$stats = self::stats();
		return array_map(
			static function ( $row ) use ( $stats ) {
				return self::to_public( self::decode( $row ), $stats[ (int) $row['id'] ] ?? null );
			},
			(array) $rows
		);
	}

	/**
	 * @param int $id Workflow id.
	 * @return array|null Browser shape with stats.
	 */
	public static function get_public( $id ) {
		$row = self::get( $id );
		if ( ! $row ) {
			return null;
		}
		$stats = self::stats( (int) $id );
		return self::to_public( $row, $stats[ (int) $id ] ?? null );
	}

	/**
	 * Aggregates per workflow.
	 *
	 * @param int $only One workflow id (0 = all).
	 * @return array<int, array>
	 */
	public static function stats( $only = 0 ) {
		global $wpdb;
		$en    = self::enrollments_table();
		$se    = self::sends_table();
		$where = $only ? $wpdb->prepare( 'WHERE workflow_id = %d', $only ) : '';
		// phpcs:disable WordPress.DB
		$enroll = $wpdb->get_results( "SELECT workflow_id, COUNT(*) AS enrolled, SUM(status = 'active') AS active, SUM(status = 'completed') AS completed, SUM(status = 'exited') AS exited, SUM(converted_at IS NOT NULL) AS converted FROM {$en} {$where} GROUP BY workflow_id", ARRAY_A );
		$sends  = $wpdb->get_results( "SELECT workflow_id, SUM(status = 'sent') AS sent, SUM(opened_at IS NOT NULL) AS opens, SUM(clicked_at IS NOT NULL) AS clicks, SUM(order_id > 0) AS orders, SUM(revenue) AS revenue FROM {$se} {$where} GROUP BY workflow_id", ARRAY_A );
		// phpcs:enable
		$out = array();
		foreach ( (array) $enroll as $r ) {
			$out[ (int) $r['workflow_id'] ] = array(
				'enrolled'  => (int) $r['enrolled'],
				'active'    => (int) $r['active'],
				'completed' => (int) $r['completed'],
				'exited'    => (int) $r['exited'],
				'converted' => (int) $r['converted'],
			);
		}
		foreach ( (array) $sends as $r ) {
			$out[ (int) $r['workflow_id'] ] = ( $out[ (int) $r['workflow_id'] ] ?? array() ) + array(
				'sent'    => (int) $r['sent'],
				'opens'   => (int) $r['opens'],
				'clicks'  => (int) $r['clicks'],
				'orders'  => (int) $r['orders'],
				'revenue' => round( (float) $r['revenue'], 2 ),
			);
		}
		return $out;
	}

	/**
	 * Per-step numbers for one workflow: events by node and action, and email stats by node.
	 *
	 * @param int $id Workflow id.
	 * @return array{events: array, emails: array, waiting: array}
	 */
	public static function node_stats( $id ) {
		global $wpdb;
		$ev = self::events_table();
		$se = self::sends_table();
		$en = self::enrollments_table();
		// phpcs:disable WordPress.DB
		$events  = $wpdb->get_results( $wpdb->prepare( "SELECT node_id, action, COUNT(*) AS n FROM {$ev} WHERE workflow_id = %d GROUP BY node_id, action", $id ), ARRAY_A );
		$emails  = $wpdb->get_results( $wpdb->prepare( "SELECT s.node_id, SUM(s.status = 'sent') AS sent, SUM(s.status = 'failed') AS failed, SUM(s.opened_at IS NOT NULL) AS opens, SUM(s.clicked_at IS NOT NULL) AS clicks, SUM(s.order_id > 0) AS orders, SUM(s.revenue) AS revenue FROM {$se} s WHERE s.workflow_id = %d GROUP BY s.node_id", $id ), ARRAY_A );
		$waiting = $wpdb->get_results( $wpdb->prepare( "SELECT node_id, COUNT(*) AS n FROM {$en} WHERE workflow_id = %d AND status = 'active' GROUP BY node_id", $id ), ARRAY_A );
		// phpcs:enable
		$out = array( 'events' => array(), 'emails' => array(), 'waiting' => array() );
		foreach ( (array) $events as $r ) {
			$out['events'][ $r['node_id'] ][ $r['action'] ] = (int) $r['n'];
		}
		foreach ( (array) $emails as $r ) {
			$out['emails'][ $r['node_id'] ] = array(
				'sent'    => (int) $r['sent'],
				'failed'  => (int) $r['failed'],
				'opens'   => (int) $r['opens'],
				'clicks'  => (int) $r['clicks'],
				'orders'  => (int) $r['orders'],
				'revenue' => round( (float) $r['revenue'], 2 ),
			);
		}
		foreach ( (array) $waiting as $r ) {
			$out['waiting'][ $r['node_id'] ] = (int) $r['n'];
		}
		return $out;
	}

	/**
	 * Most recently active contacts in a workflow (for the detail screen).
	 *
	 * @param int $id    Workflow id.
	 * @param int $limit Rows.
	 * @return array[]
	 */
	public static function recent_enrollments( $id, $limit = 8 ) {
		global $wpdb;
		$en       = self::enrollments_table();
		$contacts = Noonfy_Contacts::table();
		$se       = self::sends_table();
		// phpcs:ignore WordPress.DB
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT e.id, e.email, e.status, e.node_id, e.next_run_at, e.entered_at, e.updated_at, e.converted_at, e.exit_reason, c.first_name, c.last_name, (SELECT s.node_id FROM {$se} s WHERE s.enrollment_id = e.id AND s.status = 'sent' ORDER BY s.id DESC LIMIT 1) AS last_email FROM {$en} e LEFT JOIN {$contacts} c ON c.id = e.contact_id WHERE e.workflow_id = %d ORDER BY (e.status = 'active') DESC, e.updated_at DESC LIMIT %d", $id, $limit ), ARRAY_A );
		$iso  = static function ( $d ) {
			return $d ? gmdate( 'c', strtotime( $d . ' UTC' ) ) : null;
		};
		return array_map(
			static function ( $r ) use ( $iso ) {
				return array(
					'id'          => (int) $r['id'],
					'name'        => trim( $r['first_name'] . ' ' . $r['last_name'] ),
					'email'       => $r['email'],
					'status'      => $r['status'],
					'nodeId'      => $r['node_id'],
					'lastEmail'   => (string) $r['last_email'],
					'nextRunAt'   => $iso( $r['next_run_at'] ),
					'enteredAt'   => $iso( $r['entered_at'] ),
					'updatedAt'   => $iso( $r['updated_at'] ),
					'converted'   => null !== $r['converted_at'],
					'exitReason'  => $r['exit_reason'],
				);
			},
			(array) $rows
		);
	}

	/**
	 * @param array      $row   Workflow row (graph decoded).
	 * @param array|null $stats Aggregates.
	 * @return array
	 */
	private static function to_public( array $row, $stats ) {
		$iso = static function ( $d ) {
			return $d ? gmdate( 'c', strtotime( $d . ' UTC' ) ) : null;
		};
		return array(
			'id'          => (int) $row['id'],
			'name'        => $row['name'],
			'emoji'       => $row['emoji'],
			'status'      => $row['status'],
			'trigger'     => $row['trigger_type'],
			'template'    => $row['template'],
			'graph'       => $row['graph'],
			'activatedAt' => $iso( $row['activated_at'] ),
			'createdAt'   => $iso( $row['created_at'] ),
			'updatedAt'   => $iso( $row['updated_at'] ),
			'stats'       => ( $stats ? $stats : array() ) + array(
				'enrolled'  => 0,
				'active'    => 0,
				'completed' => 0,
				'exited'    => 0,
				'converted' => 0,
				'sent'      => 0,
				'opens'     => 0,
				'clicks'    => 0,
				'orders'    => 0,
				'revenue'   => 0,
			),
		);
	}

	/** @return array A new workflow's graph: just a trigger. */
	public static function default_graph() {
		return array(
			'nodes' => array(
				array( 'id' => 'n1', 'kind' => 'trigger', 'name' => __( 'Contact subscribes', 'noonfy' ), 'x' => 160, 'y' => 40, 'settings' => array( 'type' => 'subscribed' ) ),
			),
			'edges' => array(),
		);
	}

	/**
	 * @param array $input name, emoji, graph, template.
	 * @return array|WP_Error New workflow (browser shape).
	 */
	public static function create( array $input ) {
		global $wpdb;
		$data               = self::sanitize( $input, null );
		$now                = gmdate( 'Y-m-d H:i:s' );
		$data['status']     = 'draft';
		$data['template']   = sanitize_key( (string) ( $input['template'] ?? '' ) );
		$data['created_at'] = $now;
		$data['updated_at'] = $now;
		$wpdb->insert( self::table(), $data ); // phpcs:ignore WordPress.DB
		return self::get_public( (int) $wpdb->insert_id );
	}

	/**
	 * Saves the builder. Live workflows can be edited: contacts already on a step that was deleted leave
	 * the workflow the next time they would move on.
	 *
	 * @param int   $id    Workflow id.
	 * @param array $input Changed fields.
	 * @return array|WP_Error
	 */
	public static function update( $id, array $input ) {
		global $wpdb;
		$row = self::get( $id );
		if ( ! $row ) {
			return new WP_Error( 'noonfy_not_found', __( 'Workflow not found.', 'noonfy' ), array( 'status' => 404 ) );
		}
		$data = self::sanitize( $input, $row );
		if ( 'live' === $row['status'] ) {
			$problem = self::validation_problem( json_decode( $data['graph'], true ) );
			if ( $problem ) {
				return new WP_Error( 'noonfy_invalid', $problem . ' ' . __( 'Pause the workflow to save unfinished changes.', 'noonfy' ), array( 'status' => 400 ) );
			}
		}
		$data['updated_at'] = gmdate( 'Y-m-d H:i:s' );
		$wpdb->update( self::table(), $data, array( 'id' => (int) $id ) ); // phpcs:ignore WordPress.DB
		if ( 'live' === $row['status'] ) {
			self::refresh_live_triggers();
		}
		return self::get_public( $id );
	}

	/**
	 * @param int    $id     Workflow id.
	 * @param string $status New status.
	 * @return array|WP_Error
	 */
	public static function set_status( $id, $status ) {
		global $wpdb;
		$row = self::get( $id );
		if ( ! $row ) {
			return new WP_Error( 'noonfy_not_found', __( 'Workflow not found.', 'noonfy' ), array( 'status' => 404 ) );
		}
		$data = array( 'status' => $status, 'updated_at' => gmdate( 'Y-m-d H:i:s' ) );
		if ( 'live' === $status ) {
			$problem = self::validation_problem( $row['graph'] );
			if ( ! $problem && ! Noonfy_Mailer::is_routing_active() ) {
				$problem = __( 'Connect an SMTP provider first (SMTP & Delivery → Connections). Automations aren’t sent with PHP mail().', 'noonfy' );
			}
			if ( $problem ) {
				return new WP_Error( 'noonfy_invalid', $problem, array( 'status' => 400 ) );
			}
			if ( ! $row['activated_at'] ) {
				$data['activated_at'] = gmdate( 'Y-m-d H:i:s' );
			}
		}
		$wpdb->update( self::table(), $data, array( 'id' => (int) $id ) ); // phpcs:ignore WordPress.DB
		self::refresh_live_triggers();
		if ( 'live' === $status ) {
			if ( 'segment' === $row['trigger_type'] ) {
				Noonfy_Automation_Triggers::enrol_segment( (int) $id );
			}
			Noonfy_Automation_Runner::queue();
		}
		return self::get_public( $id );
	}

	/**
	 * @param int $id Workflow id.
	 * @return array|WP_Error Copy as a draft.
	 */
	public static function duplicate( $id ) {
		$row = self::get( $id );
		if ( ! $row ) {
			return new WP_Error( 'noonfy_not_found', __( 'Workflow not found.', 'noonfy' ), array( 'status' => 404 ) );
		}
		/* translators: %s: workflow name */
		$row['name'] = sprintf( __( '%s (copy)', 'noonfy' ), $row['name'] );
		return self::create( $row );
	}

	/**
	 * Deletes a workflow with its enrollments, sends and events.
	 *
	 * @param int $id Workflow id.
	 * @return true|WP_Error
	 */
	public static function delete( $id ) {
		global $wpdb;
		if ( ! self::get( $id ) ) {
			return new WP_Error( 'noonfy_not_found', __( 'Workflow not found.', 'noonfy' ), array( 'status' => 404 ) );
		}
		foreach ( array( self::events_table(), self::sends_table(), self::enrollments_table() ) as $t ) {
			$wpdb->delete( $t, array( 'workflow_id' => (int) $id ) ); // phpcs:ignore WordPress.DB
		}
		$wpdb->delete( self::table(), array( 'id' => (int) $id ) ); // phpcs:ignore WordPress.DB
		self::refresh_live_triggers();
		return true;
	}

	/**
	 * @param array      $in       Submitted fields.
	 * @param array|null $existing Saved workflow.
	 * @return array DB columns.
	 */
	private static function sanitize( array $in, $existing ) {
		$name  = sanitize_text_field( (string) ( $in['name'] ?? ( $existing['name'] ?? '' ) ) );
		$emoji = (string) ( $in['emoji'] ?? ( $existing['emoji'] ?? '⚡' ) );
		$graph = self::sanitize_graph( array_key_exists( 'graph', $in ) ? $in['graph'] : ( $existing['graph'] ?? self::default_graph() ) );
		$tn    = self::trigger_node( $graph );
		return array(
			'name'         => mb_substr( '' !== $name ? $name : __( 'Untitled workflow', 'noonfy' ), 0, 190 ),
			'emoji'        => in_array( $emoji, self::EMOJIS, true ) ? $emoji : '⚡',
			'trigger_type' => $tn ? $tn['settings']['type'] : '',
			'graph'        => wp_json_encode( $graph ),
		);
	}

	/**
	 * Drops unknown kinds, fields and dangling edges. Keeps at most one trigger node.
	 *
	 * @param mixed $graph Submitted graph.
	 * @return array
	 */
	public static function sanitize_graph( $graph ) {
		$graph   = is_array( $graph ) ? $graph : array();
		$nodes   = array();
		$ids     = array();
		$trigger = false;
		foreach ( array_slice( (array) ( $graph['nodes'] ?? array() ), 0, 60 ) as $n ) {
			if ( ! is_array( $n ) || ! in_array( $n['kind'] ?? '', self::KINDS, true ) ) {
				continue;
			}
			$id = substr( preg_replace( '/[^a-z0-9_-]/i', '', (string) ( $n['id'] ?? '' ) ), 0, 20 );
			if ( '' === $id || isset( $ids[ $id ] ) || ( 'trigger' === $n['kind'] && $trigger ) ) {
				continue;
			}
			$trigger    = $trigger || 'trigger' === $n['kind'];
			$ids[ $id ] = $n['kind'];
			$nodes[]    = array(
				'id'       => $id,
				'kind'     => $n['kind'],
				'name'     => mb_substr( sanitize_text_field( (string) ( $n['name'] ?? '' ) ), 0, 120 ),
				'x'        => max( 0, min( 5000, (int) ( $n['x'] ?? 0 ) ) ),
				'y'        => max( 0, min( 5000, (int) ( $n['y'] ?? 0 ) ) ),
				'settings' => self::sanitize_settings( $n['kind'], is_array( $n['settings'] ?? null ) ? $n['settings'] : array() ),
			);
		}

		$edges = array();
		$used  = array();
		foreach ( (array) ( $graph['edges'] ?? array() ) as $e ) {
			if ( ! is_array( $e ) ) {
				continue;
			}
			$from = (string) ( $e['from'] ?? '' );
			$to   = (string) ( $e['to'] ?? '' );
			$port = (string) ( $e['port'] ?? 'out' );
			if ( ! isset( $ids[ $from ], $ids[ $to ] ) || $from === $to || 'trigger' === $ids[ $to ] || ! in_array( $port, self::ports( $ids[ $from ] ), true ) || isset( $used[ $from . '|' . $port ] ) ) {
				continue;
			}
			$used[ $from . '|' . $port ] = true;
			$edges[]                     = array( 'from' => $from, 'to' => $to, 'port' => $port );
		}
		return array( 'nodes' => $nodes, 'edges' => $edges );
	}

	/**
	 * @param string $kind Node kind.
	 * @return string[] Output ports.
	 */
	public static function ports( $kind ) {
		return self::PORTS[ $kind ] ?? array( 'out' );
	}

	/**
	 * @param string $kind Node kind.
	 * @param array  $s    Submitted settings.
	 * @return array
	 */
	private static function sanitize_settings( $kind, array $s ) {
		$int   = static function ( $k, $default, $min, $max ) use ( $s ) {
			return max( $min, min( $max, (int) ( $s[ $k ] ?? $default ) ) );
		};
		$money = static function ( $k ) use ( $s ) {
			return max( 0, round( (float) ( $s[ $k ] ?? 0 ), 2 ) );
		};
		$unit  = in_array( $s['unit'] ?? '', self::UNITS, true ) ? $s['unit'] : 'hours';
		switch ( $kind ) {
			case 'trigger':
				$type    = in_array( $s['type'] ?? '', self::TRIGGERS, true ) ? $s['type'] : 'subscribed';
				$segment = (string) ( $s['segment'] ?? 'all' );
				return array(
					'type'       => $type,
					'firstOrder' => rest_sanitize_boolean( $s['firstOrder'] ?? false ),
					'minTotal'   => $money( 'minTotal' ),
					'days'       => $int( 'days', 90, 7, 730 ),
					'amount'     => $money( 'amount' ) ? $money( 'amount' ) : 500,
					'minutes'    => $int( 'minutes', 60, 15, 10080 ),
					'hours'      => $int( 'hours', 2, 1, 168 ),
					'segment'    => array_key_exists( $segment, Noonfy_Contacts::SEGMENTS ) ? $segment : 'all',
					'reentry'    => array_key_exists( 'reentry', $s ) ? rest_sanitize_boolean( $s['reentry'] ) : in_array( $type, self::REPEATABLE, true ),
				);
			case 'delay':
				return array( 'amount' => $int( 'amount', 1, 1, 365 ), 'unit' => $unit );
			case 'email':
				return array(
					'subject'   => mb_substr( sanitize_text_field( (string) ( $s['subject'] ?? '' ) ), 0, 255 ),
					'preheader' => mb_substr( sanitize_text_field( (string) ( $s['preheader'] ?? '' ) ), 0, 255 ),
					'content'   => Noonfy_Campaigns::sanitize_content( isset( $s['content'] ) ? $s['content'] : Noonfy_Campaigns::default_content() ),
				);
			case 'condition':
				return array(
					'check' => in_array( $s['check'] ?? '', self::CHECKS, true ) ? $s['check'] : 'ordered',
					'value' => $money( 'value' ),
				);
			case 'wait':
				return array(
					'event'  => in_array( $s['event'] ?? '', self::EVENTS, true ) ? $s['event'] : 'ordered',
					'amount' => $int( 'amount', 2, 1, 365 ),
					'unit'   => in_array( $s['unit'] ?? '', self::UNITS, true ) ? $s['unit'] : 'days',
				);
			case 'split':
				return array( 'pct' => $int( 'pct', 50, 1, 99 ) );
		}
		return array();
	}

	/**
	 * What stops a workflow from going live, if anything.
	 *
	 * @param array $graph Sanitized graph.
	 * @return string|null
	 */
	public static function validation_problem( array $graph ) {
		$trigger = self::trigger_node( $graph );
		if ( ! $trigger ) {
			return __( 'Add a trigger to start the workflow.', 'noonfy' );
		}
		if ( ! self::next_node( $graph, $trigger['id'], 'out' ) ) {
			return __( 'Connect the trigger to the first step.', 'noonfy' );
		}
		$emails = 0;
		foreach ( $graph['nodes'] as $n ) {
			if ( 'email' === $n['kind'] ) {
				++$emails;
				if ( '' === trim( $n['settings']['subject'] ) ) {
					/* translators: %s: step name */
					return sprintf( __( 'Add a subject line to “%s”.', 'noonfy' ), $n['name'] ? $n['name'] : __( 'Email', 'noonfy' ) );
				}
			}
		}
		if ( ! $emails ) {
			return __( 'Add at least one email step.', 'noonfy' );
		}
		// Loops could email the same person forever.
		$out = array();
		foreach ( $graph['edges'] as $e ) {
			$out[ $e['from'] ][] = $e['to'];
		}
		$state = array();
		$visit = static function ( $id ) use ( &$visit, &$state, $out ) {
			$state[ $id ] = 1;
			foreach ( $out[ $id ] ?? array() as $to ) {
				if ( 1 === ( $state[ $to ] ?? 0 ) || ( ! isset( $state[ $to ] ) && $visit( $to ) ) ) {
					return true;
				}
			}
			$state[ $id ] = 2;
			return false;
		};
		if ( $visit( $trigger['id'] ) ) {
			return __( 'The workflow loops back on itself. Remove the connection that goes back to an earlier step.', 'noonfy' );
		}
		return null;
	}
}
