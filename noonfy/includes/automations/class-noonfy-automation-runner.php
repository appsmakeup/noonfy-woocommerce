<?php
/**
 * Moves enrolled contacts through workflows and sends automation emails.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Each enrollment sits on one step (node_id). Steps that act immediately — email, condition, split,
 * exit — run as soon as a contact reaches them; delay, wait and the trigger hold the contact until
 * next_run_at. A WP-Cron event every five minutes (plus admin-screen polling) processes everyone due.
 *
 * Emails go through wp_mail(), so Noonfy's SMTP routing and failover apply, but never fall back to PHP
 * mail(): with no usable connection the contact waits on the email step and it is retried later.
 */
class Noonfy_Automation_Runner {

	const RUN_HOOK   = 'noonfy_automations_run';
	const NOW_HOOK   = 'noonfy_automations_run_now';
	const DAILY_HOOK = 'noonfy_automations_daily';
	const SCHEDULE   = 'noonfy_five_minutes';
	const TIME_LIMIT = 20;
	const LOCK       = 'noonfy_automation_lock';

	/** Hooks the cron events. */
	public static function init() {
		add_filter( 'cron_schedules', array( __CLASS__, 'cron_schedules' ) ); // phpcs:ignore WordPress.WP.CronInterval -- five minutes.
		add_action( self::RUN_HOOK, array( __CLASS__, 'cron' ) );
		add_action( self::NOW_HOOK, array( __CLASS__, 'cron' ) );
		add_action( self::DAILY_HOOK, array( 'Noonfy_Automation_Triggers', 'daily' ) );
		if ( ! wp_next_scheduled( self::RUN_HOOK ) ) {
			wp_schedule_event( time() + 60, self::SCHEDULE, self::RUN_HOOK );
		}
		if ( ! wp_next_scheduled( self::DAILY_HOOK ) ) {
			wp_schedule_event( time() + 10 * MINUTE_IN_SECONDS, 'daily', self::DAILY_HOOK );
		}
	}

	/**
	 * @param array $schedules Cron schedules.
	 * @return array
	 */
	public static function cron_schedules( $schedules ) {
		$schedules[ self::SCHEDULE ] = array(
			'interval' => 5 * MINUTE_IN_SECONDS,
			'display'  => __( 'Every five minutes (Noonfy)', 'noonfy' ),
		);
		return $schedules;
	}

	/** Cron: look for abandoned carts and product views, then advance everyone due. */
	public static function cron() {
		Noonfy_Automation_Triggers::scan();
		self::run();
	}

	/** Asks WP-Cron to run soon (after an enrollment, so a first email without delay goes out quickly). */
	public static function queue() {
		if ( ! wp_next_scheduled( self::NOW_HOOK ) ) {
			wp_schedule_single_event( time(), self::NOW_HOOK );
		}
	}

	/**
	 * Called when admin screens poll: does the cron's work if it is overdue, so automations keep moving on
	 * sites with little front-end traffic.
	 */
	public static function tick() {
		$next = wp_next_scheduled( self::RUN_HOOK );
		if ( ! $next || $next < time() - 60 || wp_next_scheduled( self::NOW_HOOK ) ) {
			wp_clear_scheduled_hook( self::NOW_HOOK );
			Noonfy_Automation_Triggers::scan();
			self::run( 8 ); // Keep the admin request short; cron does the rest.
		}
	}

	/**
	 * Whether automation email may go to a contact.
	 *
	 * Unsubscribed: never. Subscribed: always. Otherwise only in the "customers and subscribers" audience
	 * mode, for customers — and for cart and browse reminders, where the shopper gave their email at
	 * checkout (under the saved-cart notice) or is signed in to their account.
	 *
	 * @param array  $contact Contact row.
	 * @param string $trigger Workflow trigger type.
	 * @return bool
	 */
	public static function can_email( array $contact, $trigger ) {
		if ( 'unsubscribed' === $contact['marketing'] ) {
			return false;
		}
		if ( 'subscribed' === $contact['marketing'] ) {
			return true;
		}
		if ( 'all' !== Noonfy_Campaign_Settings::get()['audienceMode'] ) {
			return false;
		}
		return (int) $contact['is_customer'] || in_array( $trigger, array( 'cart_abandoned', 'browse_abandoned' ), true );
	}

	/**
	 * Puts a contact into a workflow at its trigger.
	 *
	 * `$ref` identifies what started this trip (e.g. "order:123"); together with the workflow and contact
	 * it is unique, so the same event never enrolls someone twice. Workflows without re-entry use an empty
	 * ref: one trip per contact, ever. Nobody is enrolled twice into a workflow at the same time.
	 *
	 * @param array  $workflow   Workflow row (graph decoded).
	 * @param int    $contact_id Contact id.
	 * @param string $ref        Event reference.
	 * @param array  $context    order_id, cart_id, product_ids.
	 * @return int Enrollment id, or 0 when not enrolled.
	 */
	public static function enrol( array $workflow, $contact_id, $ref = '', array $context = array() ) {
		global $wpdb;
		$trigger = Noonfy_Workflows::trigger_node( $workflow['graph'] );
		$contact = self::contact( $contact_id );
		if ( ! $trigger || ! $contact || 'live' !== $workflow['status'] || ! self::can_email( $contact, $workflow['trigger_type'] ) ) {
			return 0;
		}
		$table = Noonfy_Workflows::enrollments_table();
		// phpcs:ignore WordPress.DB
		if ( $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE workflow_id = %d AND contact_id = %d AND status = 'active' LIMIT 1", $workflow['id'], $contact_id ) ) ) {
			return 0;
		}
		$ref = empty( $trigger['settings']['reentry'] ) ? '' : mb_substr( (string) $ref, 0, 64 );
		$now = gmdate( 'Y-m-d H:i:s' );
		// phpcs:ignore WordPress.DB
		$inserted = $wpdb->query(
			$wpdb->prepare(
				"INSERT IGNORE INTO {$table} (workflow_id, contact_id, email, ref, status, node_id, next_run_at, context, entered_at, updated_at) VALUES (%d, %d, %s, %s, 'active', %s, %s, %s, %s, %s)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$workflow['id'],
				$contact_id,
				$contact['email'],
				$ref,
				$trigger['id'],
				$now,
				wp_json_encode( (object) $context ),
				$now,
				$now
			)
		);
		if ( ! $inserted ) {
			return 0;
		}
		$id = (int) $wpdb->insert_id;
		self::event( (int) $workflow['id'], $id, $trigger['id'] );
		self::queue();
		return $id;
	}

	/**
	 * @param int $id Contact id.
	 * @return array|null
	 */
	private static function contact( $id ) {
		global $wpdb;
		$table = Noonfy_Contacts::table();
		return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", (int) $id ), ARRAY_A ); // phpcs:ignore WordPress.DB
	}

	/**
	 * Records that an enrollment entered a step (or which branch it took).
	 *
	 * @param int    $workflow_id   Workflow id.
	 * @param int    $enrollment_id Enrollment id.
	 * @param string $node_id       Node id.
	 * @param string $action        enter, yes, no, a, b.
	 */
	private static function event( $workflow_id, $enrollment_id, $node_id, $action = 'enter' ) {
		global $wpdb;
		$wpdb->insert( // phpcs:ignore WordPress.DB
			Noonfy_Workflows::events_table(),
			array(
				'workflow_id'   => (int) $workflow_id,
				'enrollment_id' => (int) $enrollment_id,
				'node_id'       => $node_id,
				'action'        => $action,
				'created_at'    => gmdate( 'Y-m-d H:i:s' ),
			)
		);
	}

	/**
	 * Advances every due enrollment of live workflows for up to `$time_limit` seconds.
	 *
	 * @param int $time_limit Seconds.
	 * @return int Enrollments processed.
	 */
	public static function run( $time_limit = self::TIME_LIMIT ) {
		global $wpdb;
		if ( ! self::lock() ) {
			return 0;
		}
		$started = time();
		$done    = 0;
		$en      = Noonfy_Workflows::enrollments_table();
		$wf      = Noonfy_Workflows::table();
		$skip    = array( 0 );
		try {
			while ( time() - $started < $time_limit ) {
				$not_in = implode( ',', array_map( 'intval', $skip ) );
				// phpcs:ignore WordPress.DB
				$rows = $wpdb->get_results( $wpdb->prepare( "SELECT e.* FROM {$en} e JOIN {$wf} w ON w.id = e.workflow_id WHERE e.status = 'active' AND w.status = 'live' AND e.next_run_at <= %s AND e.id NOT IN ({$not_in}) ORDER BY e.next_run_at LIMIT 50", gmdate( 'Y-m-d H:i:s' ) ), ARRAY_A );
				if ( ! $rows ) {
					break;
				}
				foreach ( $rows as $row ) {
					if ( ! self::advance( $row ) ) {
						$skip[] = (int) $row['id']; // Still due (waiting for SMTP); don't spin on it this run.
					}
					++$done;
					if ( time() - $started >= $time_limit ) {
						break 2;
					}
				}
			}
		} finally {
			self::unlock();
		}
		return $done;
	}

	/**
	 * Moves one due enrollment along until it reaches a step that waits, or the end.
	 *
	 * @param array $row Enrollment row.
	 * @return bool False if it is still due afterwards (left for a later run).
	 */
	private static function advance( array $row ) {
		$workflow = self::workflow( (int) $row['workflow_id'] );
		$graph    = $workflow['graph'];
		$node     = Noonfy_Workflows::node( $graph, $row['node_id'] );
		if ( ! $node ) {
			self::finish( $row, 'exited', 'step_removed' );
			return true;
		}
		$row['context'] = json_decode( (string) $row['context'], true );
		$row['context'] = is_array( $row['context'] ) ? $row['context'] : array();

		// What the current (holding) step does now that it is due.
		switch ( $node['kind'] ) {
			case 'wait':
				$port = self::wait_outcome( $row, $node );
				if ( ! $port ) {
					return true;
				}
				break;
			case 'email':
				// Waiting for an SMTP connection: try the email again.
				$result = self::run_step( $workflow, $row, $node, false );
				if ( null === $result ) {
					return false;
				}
				if ( false === $result ) {
					return true;
				}
				$port = $result;
				break;
			default:
				$port = 'out';
		}

		for ( $steps = 0; $steps < 30; $steps++ ) {
			$next = Noonfy_Workflows::next_node( $graph, $node['id'], $port );
			if ( ! $next ) {
				self::finish( $row, 'completed' );
				return true;
			}
			$node = $next;
			self::move( $row, $node['id'] );
			self::event( (int) $workflow['id'], (int) $row['id'], $node['id'] );
			$port = self::run_step( $workflow, $row, $node, true );
			if ( null === $port ) {
				return true; // Holding (delay, wait, or email retry later).
			}
			if ( false === $port ) {
				return true; // Finished (exit step, or left the workflow).
			}
		}
		self::finish( $row, 'exited', 'too_many_steps' );
		return true;
	}

	/**
	 * Runs a step the contact just reached.
	 *
	 * @param array $workflow Workflow.
	 * @param array $row      Enrollment (context decoded; updated in place).
	 * @param array $node     Step.
	 * @param bool  $first    First time on this step (false when retrying an email).
	 * @return string|null|false Port to leave by; null to hold here; false when the trip ended.
	 */
	private static function run_step( array $workflow, array &$row, array $node, $first ) {
		$s = $node['settings'];
		switch ( $node['kind'] ) {
			case 'delay':
				self::hold( $row, time() + self::seconds( $s['amount'], $s['unit'] ) );
				return null;

			case 'wait':
				$row['context']['wait_until'] = time() + self::seconds( $s['amount'], $s['unit'] );
				$port                         = self::wait_outcome( $row, $node );
				return $port ? $port : null;

			case 'email':
				$sent = self::send_email( $workflow, $row, $node );
				if ( 'retry' === $sent ) {
					self::hold( $row, time() + 15 * MINUTE_IN_SECONDS );
					return null;
				}
				if ( 'no_consent' === $sent ) {
					self::finish( $row, 'exited', 'unsubscribed' );
					return false;
				}
				return 'out';

			case 'condition':
				$port = self::check( $row, $s['check'], (float) $s['value'] ) ? 'yes' : 'no';
				self::event( (int) $workflow['id'], (int) $row['id'], $node['id'], $port );
				return $port;

			case 'split':
				$port = wp_rand( 1, 100 ) <= (int) $s['pct'] ? 'a' : 'b';
				self::event( (int) $workflow['id'], (int) $row['id'], $node['id'], $port );
				return $port;

			case 'exit':
				self::finish( $row, 'completed' );
				return false;
		}
		return 'out'; // goal (passed through without an order) and anything else.
	}

	/**
	 * @param array $row  Enrollment (context decoded).
	 * @param array $node Wait step.
	 * @return string|null 'yes' when the event happened, 'no' when it timed out, null to keep waiting
	 *                     (the enrollment is rescheduled).
	 */
	private static function wait_outcome( array &$row, array $node ) {
		if ( self::check( $row, $node['settings']['event'], 0 ) ) {
			$port = 'yes';
		} elseif ( time() >= (int) ( $row['context']['wait_until'] ?? 0 ) ) {
			$port = 'no';
		} else {
			// Re-check every 15 minutes until the timeout.
			self::hold( $row, min( (int) $row['context']['wait_until'], time() + 15 * MINUTE_IN_SECONDS ) );
			return null;
		}
		self::event( (int) $row['workflow_id'], (int) $row['id'], $node['id'], $port );
		return $port;
	}

	/**
	 * @param array  $row   Enrollment.
	 * @param string $check Condition.
	 * @param float  $value Threshold.
	 * @return bool
	 */
	private static function check( array $row, $check, $value ) {
		global $wpdb;
		$se = Noonfy_Workflows::sends_table();
		switch ( $check ) {
			case 'opened':
				return (bool) $wpdb->get_var( $wpdb->prepare( "SELECT 1 FROM {$se} WHERE enrollment_id = %d AND opened_at IS NOT NULL LIMIT 1", $row['id'] ) ); // phpcs:ignore WordPress.DB
			case 'clicked':
				return (bool) $wpdb->get_var( $wpdb->prepare( "SELECT 1 FROM {$se} WHERE enrollment_id = %d AND clicked_at IS NOT NULL LIMIT 1", $row['id'] ) ); // phpcs:ignore WordPress.DB
		}
		$contact = self::contact( (int) $row['contact_id'] );
		if ( ! $contact ) {
			return false;
		}
		switch ( $check ) {
			case 'ordered':
				return $contact['last_order_at'] && $contact['last_order_at'] >= $row['entered_at'];
			case 'spent':
				return (float) $contact['total_spent'] >= $value;
			case 'orders':
				return (int) $contact['orders_count'] >= $value;
			case 'subscribed':
				return 'subscribed' === $contact['marketing'];
		}
		return false;
	}

	/**
	 * Sends one automation email.
	 *
	 * @param array $workflow Workflow.
	 * @param array $row      Enrollment (context decoded).
	 * @param array $node     Email step.
	 * @return string 'sent', 'failed', 'retry' (no SMTP connection available) or 'no_consent'.
	 */
	private static function send_email( array $workflow, array $row, array $node ) {
		global $wpdb;
		$contact = self::contact( (int) $row['contact_id'] );
		if ( ! $contact || ! self::can_email( $contact, $workflow['trigger_type'] ) ) {
			return 'no_consent';
		}
		if ( ! Noonfy_Mailer::is_routing_active() || ! Noonfy_Router::candidates() ) {
			return 'retry';
		}

		$table = Noonfy_Workflows::sends_table();
		$wpdb->insert( // phpcs:ignore WordPress.DB
			$table,
			array(
				'workflow_id'   => (int) $workflow['id'],
				'enrollment_id' => (int) $row['id'],
				'node_id'       => $node['id'],
				'contact_id'    => (int) $contact['id'],
				'email'         => $contact['email'],
				'status'        => 'sending',
			)
		);
		$sid   = (int) $wpdb->insert_id;
		$email = array(
			'subject'   => $node['settings']['subject'],
			'preheader' => $node['settings']['preheader'],
			'content'   => $node['settings']['content'],
		);
		$unsub = Noonfy_Tracking::unsubscribe_url( $contact['token'] );
		$html  = Noonfy_Email_Renderer::render(
			$email,
			array(
				'contact'         => $contact,
				'unsubscribe_url' => $unsub,
				'pixel_url'       => Noonfy_Tracking::open_url( $sid, 'a' ),
				'link'            => static function ( $url ) use ( $sid ) {
					return Noonfy_Tracking::click_url( $sid, $url, 'a' );
				},
			) + self::dynamic( $row['context'] )
		);

		$error   = '';
		$capture = static function ( $e ) use ( &$error ) {
			$error = $e->get_error_message();
		};
		add_action( 'wp_mail_failed', $capture );
		$sent = wp_mail(
			$contact['email'],
			Noonfy_Email_Renderer::merge( $email['subject'], $contact ),
			$html,
			array(
				'Content-Type: text/html; charset=UTF-8',
				'List-Unsubscribe: <' . $unsub . '>',
				'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
			)
		);
		remove_action( 'wp_mail_failed', $capture );
		$wpdb->update( // phpcs:ignore WordPress.DB
			$table,
			$sent ? array( 'status' => 'sent', 'sent_at' => gmdate( 'Y-m-d H:i:s' ) ) : array( 'status' => 'failed', 'error' => mb_substr( $error, 0, 255 ) ),
			array( 'id' => $sid )
		);
		return $sent ? 'sent' : 'failed';
	}

	/**
	 * Products and links that depend on why the contact is in the workflow.
	 *
	 * @param array $context Enrollment context.
	 * @return array Renderer context: products (by source), cart_url.
	 */
	public static function dynamic( array $context ) {
		$products = array( 'cart' => array(), 'order' => array(), 'viewed' => array(), 'cross_sells' => array() );
		$cart_url = '';
		if ( ! empty( $context['cart_id'] ) ) {
			$cart = Noonfy_Carts::get( (int) $context['cart_id'] );
			if ( $cart ) {
				$products['cart'] = Noonfy_Carts::product_ids( $cart );
				$cart_url         = Noonfy_Carts::restore_url( $cart['token'] );
			}
		}
		if ( ! empty( $context['order_id'] ) && function_exists( 'wc_get_order' ) ) {
			$order = wc_get_order( (int) $context['order_id'] );
			if ( $order ) {
				foreach ( $order->get_items() as $item ) {
					$products['order'][] = (int) $item->get_product_id();
				}
			}
		}
		if ( ! empty( $context['product_ids'] ) ) {
			$products['viewed'] = array_map( 'intval', (array) $context['product_ids'] );
		}
		$bought = array_unique( array_merge( $products['order'], $products['cart'] ) );
		foreach ( $bought as $pid ) {
			$product = function_exists( 'wc_get_product' ) ? wc_get_product( $pid ) : null;
			if ( $product ) {
				$products['cross_sells'] = array_merge( $products['cross_sells'], array_map( 'intval', $product->get_cross_sell_ids() ) );
			}
		}
		$products['cross_sells'] = array_values( array_diff( array_unique( $products['cross_sells'] ), $bought ) );
		return array( 'products' => $products, 'cart_url' => $cart_url );
	}

	/**
	 * @param int    $amount Amount.
	 * @param string $unit   minutes, hours or days.
	 * @return int Seconds.
	 */
	private static function seconds( $amount, $unit ) {
		$per = array( 'minutes' => MINUTE_IN_SECONDS, 'hours' => HOUR_IN_SECONDS, 'days' => DAY_IN_SECONDS );
		return (int) $amount * ( $per[ $unit ] ?? HOUR_IN_SECONDS );
	}

	/**
	 * @param array  $row     Enrollment (context decoded; updated in place).
	 * @param string $node_id New step.
	 */
	private static function move( array &$row, $node_id ) {
		$row['node_id'] = $node_id;
		self::save( $row, array( 'node_id' => $node_id ) );
	}

	/**
	 * @param array $row Enrollment.
	 * @param int   $at  Unix time to run again.
	 */
	private static function hold( array &$row, $at ) {
		self::save( $row, array( 'next_run_at' => gmdate( 'Y-m-d H:i:s', $at ) ) );
	}

	/**
	 * @param array  $row    Enrollment.
	 * @param string $status completed or exited.
	 * @param string $reason Why it exited.
	 */
	private static function finish( array &$row, $status, $reason = '' ) {
		$row['status'] = $status;
		self::save(
			$row,
			array(
				'status'      => $status,
				'exit_reason' => $reason,
				'next_run_at' => null,
				'finished_at' => gmdate( 'Y-m-d H:i:s' ),
			)
		);
	}

	/**
	 * @param array $row    Enrollment (context decoded).
	 * @param array $fields Columns to set.
	 */
	private static function save( array $row, array $fields ) {
		global $wpdb;
		$fields['updated_at'] = gmdate( 'Y-m-d H:i:s' );
		if ( is_array( $row['context'] ) ) {
			$fields['context'] = wp_json_encode( (object) $row['context'] );
		}
		$wpdb->update( Noonfy_Workflows::enrollments_table(), $fields, array( 'id' => (int) $row['id'] ) ); // phpcs:ignore WordPress.DB
	}

	/**
	 * @param int $id Workflow id.
	 * @return array|null Cached for the request.
	 */
	private static function workflow( $id ) {
		static $cache = array();
		if ( ! array_key_exists( $id, $cache ) ) {
			$cache[ $id ] = Noonfy_Workflows::get( $id );
		}
		return $cache[ $id ];
	}

	/**
	 * A paid order from a contact in workflows: counts as a conversion where they've been emailed, jumps
	 * them to the workflow's goal step if it has one, and ends cart and browse reminders.
	 *
	 * @param int      $contact_id Contact id.
	 * @param WC_Order $order      Order.
	 */
	public static function order_placed( $contact_id, $order ) {
		global $wpdb;
		$en   = Noonfy_Workflows::enrollments_table();
		$se   = Noonfy_Workflows::sends_table();
		$now  = gmdate( 'Y-m-d H:i:s' );
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$en} WHERE contact_id = %d AND status = 'active'", (int) $contact_id ), ARRAY_A ); // phpcs:ignore WordPress.DB
		foreach ( (array) $rows as $row ) {
			$workflow = Noonfy_Workflows::get( (int) $row['workflow_id'] );
			if ( ! $workflow ) {
				continue;
			}
			$row['context'] = json_decode( (string) $row['context'], true );
			$emailed        = (bool) $wpdb->get_var( $wpdb->prepare( "SELECT 1 FROM {$se} WHERE enrollment_id = %d AND status = 'sent' LIMIT 1", $row['id'] ) ); // phpcs:ignore WordPress.DB
			if ( $emailed && ! $row['converted_at'] ) {
				$wpdb->update( $en, array( 'converted_at' => $now, 'revenue' => (float) $order->get_total() ), array( 'id' => $row['id'] ) ); // phpcs:ignore WordPress.DB
			}
			$goal = null;
			foreach ( $workflow['graph']['nodes'] as $n ) {
				if ( 'goal' === $n['kind'] ) {
					$goal = $n;
					break;
				}
			}
			if ( $goal ) {
				if ( $row['node_id'] !== $goal['id'] ) {
					if ( ! $row['converted_at'] && ! $emailed ) {
						$wpdb->update( $en, array( 'converted_at' => $now, 'revenue' => (float) $order->get_total() ), array( 'id' => $row['id'] ) ); // phpcs:ignore WordPress.DB
					}
					// Continue from the goal (e.g. a thank-you email) at the next run.
					self::save( $row, array( 'node_id' => $goal['id'], 'next_run_at' => $now ) );
					self::event( (int) $workflow['id'], (int) $row['id'], $goal['id'] );
					self::queue();
				}
			} elseif ( in_array( $workflow['trigger_type'], array( 'cart_abandoned', 'browse_abandoned' ), true ) ) {
				self::finish( $row, 'exited', 'ordered' );
			}
		}
	}

	/**
	 * Credits an order to the automation email that drove it (see Noonfy_Tracking::attribute_order).
	 *
	 * @param int      $sid   Send id.
	 * @param WC_Order $order Order.
	 */
	public static function credit_send( $sid, $order ) {
		global $wpdb;
		$se = Noonfy_Workflows::sends_table();
		$wpdb->query( $wpdb->prepare( "UPDATE {$se} SET order_id = %d, revenue = revenue + %f WHERE id = %d", $order->get_id(), (float) $order->get_total(), (int) $sid ) ); // phpcs:ignore WordPress.DB
	}

	/**
	 * Contacts leave every workflow when they unsubscribe.
	 *
	 * @param int $contact_id Contact id.
	 */
	public static function unsubscribed( $contact_id ) {
		global $wpdb;
		$en = Noonfy_Workflows::enrollments_table();
		$wpdb->query( $wpdb->prepare( "UPDATE {$en} SET status = 'exited', exit_reason = 'unsubscribed', next_run_at = NULL, finished_at = %s, updated_at = %s WHERE contact_id = %d AND status = 'active'", gmdate( 'Y-m-d H:i:s' ), gmdate( 'Y-m-d H:i:s' ), (int) $contact_id ) ); // phpcs:ignore WordPress.DB
	}

	/**
	 * Removes one contact from a workflow (from the detail screen).
	 *
	 * @param int $enrollment_id Enrollment id.
	 * @return bool
	 */
	public static function remove( $enrollment_id ) {
		global $wpdb;
		$en = Noonfy_Workflows::enrollments_table();
		return (bool) $wpdb->query( $wpdb->prepare( "UPDATE {$en} SET status = 'exited', exit_reason = 'removed', next_run_at = NULL, finished_at = %s, updated_at = %s WHERE id = %d AND status = 'active'", gmdate( 'Y-m-d H:i:s' ), gmdate( 'Y-m-d H:i:s' ), (int) $enrollment_id ) ); // phpcs:ignore WordPress.DB
	}

	/**
	 * Test run: sends every email step of a (possibly unsaved) graph to one address, in workflow order,
	 * with sample products. Links aren't tracked.
	 *
	 * @param array  $graph Graph.
	 * @param string $to    Recipient.
	 * @return int|WP_Error Emails sent.
	 */
	public static function test_run( array $graph, $to ) {
		if ( ! is_email( $to ) ) {
			return new WP_Error( 'noonfy_bad_email', __( 'Enter a valid email address for the test.', 'noonfy' ), array( 'status' => 400 ) );
		}
		$problem = Noonfy_Campaign_Sender::connection_problem();
		if ( $problem ) {
			return new WP_Error( 'noonfy_not_ready', $problem, array( 'status' => 400 ) );
		}
		$emails = self::emails_in_order( Noonfy_Workflows::sanitize_graph( $graph ) );
		if ( ! $emails ) {
			return new WP_Error( 'noonfy_no_emails', __( 'Add an email step to test.', 'noonfy' ), array( 'status' => 400 ) );
		}
		$contact = Noonfy_Campaign_Sender::admin_contact( $to );
		$ctx     = array( 'contact' => $contact, 'unsubscribe_url' => home_url( '/' ) ) + self::sample_dynamic();
		$sent    = 0;
		$error   = '';
		$capture = static function ( $e ) use ( &$error ) {
			$error = $e->get_error_message();
		};
		add_action( 'wp_mail_failed', $capture );
		foreach ( $emails as $i => $node ) {
			$s    = $node['settings'];
			$html = Noonfy_Email_Renderer::render( $s, $ctx );
			/* translators: 1: step number, 2: subject */
			$subject = sprintf( __( '[Test %1$d] %2$s', 'noonfy' ), $i + 1, Noonfy_Email_Renderer::merge( $s['subject'], $contact ) );
			if ( wp_mail( $to, $subject, $html, array( 'Content-Type: text/html; charset=UTF-8' ) ) ) {
				++$sent;
			}
		}
		remove_action( 'wp_mail_failed', $capture );
		return $sent ? $sent : new WP_Error( 'noonfy_mail_failed', $error ? $error : __( 'The test emails could not be sent.', 'noonfy' ), array( 'status' => 500 ) );
	}

	/**
	 * @param array $graph Graph.
	 * @return array[] Email nodes reachable from the trigger, breadth first (then unconnected ones).
	 */
	public static function emails_in_order( array $graph ) {
		$order   = array();
		$seen    = array();
		$trigger = Noonfy_Workflows::trigger_node( $graph );
		$queue   = $trigger ? array( $trigger['id'] ) : array();
		while ( $queue ) {
			$id = array_shift( $queue );
			if ( isset( $seen[ $id ] ) ) {
				continue;
			}
			$seen[ $id ] = true;
			$order[]     = $id;
			foreach ( $graph['edges'] as $e ) {
				if ( $e['from'] === $id ) {
					$queue[] = $e['to'];
				}
			}
		}
		foreach ( $graph['nodes'] as $n ) {
			if ( ! isset( $seen[ $n['id'] ] ) ) {
				$order[] = $n['id'];
			}
		}
		$out = array();
		foreach ( $order as $id ) {
			$n = Noonfy_Workflows::node( $graph, $id );
			if ( $n && 'email' === $n['kind'] ) {
				$out[] = $n;
			}
		}
		return $out;
	}

	/** @return array Renderer context with the store's newest products standing in for cart, order and views. */
	public static function sample_dynamic() {
		$ids = function_exists( 'wc_get_products' ) ? array_map( 'intval', (array) wc_get_products( array( 'status' => 'publish', 'limit' => 4, 'return' => 'ids' ) ) ) : array();
		return array(
			'products' => array( 'cart' => array_slice( $ids, 0, 2 ), 'order' => array_slice( $ids, 0, 2 ), 'viewed' => array_slice( $ids, 0, 2 ), 'cross_sells' => array_slice( $ids, 2, 2 ) ),
			'cart_url' => function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : home_url( '/' ),
		);
	}

	/** @return bool Lock acquired (stale after 2 minutes). */
	private static function lock() {
		if ( add_option( self::LOCK, time(), '', false ) ) {
			return true;
		}
		if ( (int) get_option( self::LOCK ) < time() - 120 ) {
			update_option( self::LOCK, time(), false );
			return true;
		}
		return false;
	}

	/** Releases the lock. */
	private static function unlock() {
		delete_option( self::LOCK );
	}
}
