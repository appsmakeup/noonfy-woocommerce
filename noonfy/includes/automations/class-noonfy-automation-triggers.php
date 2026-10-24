<?php
/**
 * What starts workflows: store events, scheduled scans and manual enrollment.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Trigger types (the trigger node's settings.type):
 * - subscribed        a contact subscribes to marketing email
 * - order_paid        an order is paid (optionally only first orders, or over a minimum total)
 * - order_completed   an order is marked completed (review requests, cross-sells)
 * - no_order          a customer hasn't ordered for N days (daily scan; once per lapse)
 * - lifetime_spend    a customer's total spend reaches an amount (once)
 * - cart_abandoned    a saved cart hasn't changed for N minutes (scan every five minutes)
 * - browse_abandoned  a signed-in shopper viewed products N hours ago without adding them to the cart
 * - segment           everyone in a segment, enrolled when the workflow goes live (and on demand)
 */
class Noonfy_Automation_Triggers {

	/** Hooks store events. */
	public static function init() {
		add_action( 'noonfy_contact_subscribed', array( __CLASS__, 'subscribed' ) );
		add_action( 'noonfy_contact_unsubscribed', array( 'Noonfy_Automation_Runner', 'unsubscribed' ) );
		add_action( 'noonfy_order_paid', array( __CLASS__, 'order_paid' ), 10, 2 );
		add_action( 'woocommerce_order_status_completed', array( __CLASS__, 'order_completed' ), 10, 2 );
	}

	/** @param int $contact_id Contact who just subscribed. */
	public static function subscribed( $contact_id ) {
		foreach ( Noonfy_Workflows::live_by_trigger( 'subscribed' ) as $wf ) {
			Noonfy_Automation_Runner::enrol( $wf, (int) $contact_id );
		}
	}

	/**
	 * Conversions for workflows the buyer is in, then order-paid and lifetime-spend triggers.
	 *
	 * @param WC_Order $order      Order that became paid.
	 * @param int      $contact_id Buyer's contact (stats already include this order).
	 */
	public static function order_paid( $order, $contact_id ) {
		Noonfy_Automation_Runner::order_placed( (int) $contact_id, $order );
		$contact = Noonfy_Contacts::by_email( $order->get_billing_email() );
		if ( ! $contact ) {
			return;
		}
		$total = (float) $order->get_total();
		foreach ( Noonfy_Workflows::live_by_trigger( 'order_paid' ) as $wf ) {
			$s = Noonfy_Workflows::trigger_node( $wf['graph'] )['settings'];
			if ( ( $s['firstOrder'] && (int) $contact['orders_count'] > 1 ) || $total < (float) $s['minTotal'] ) {
				continue;
			}
			Noonfy_Automation_Runner::enrol( $wf, (int) $contact['id'], 'order:' . $order->get_id(), array( 'order_id' => $order->get_id() ) );
		}
		foreach ( Noonfy_Workflows::live_by_trigger( 'lifetime_spend' ) as $wf ) {
			$s = Noonfy_Workflows::trigger_node( $wf['graph'] )['settings'];
			if ( (float) $contact['total_spent'] >= (float) $s['amount'] ) {
				Noonfy_Automation_Runner::enrol( $wf, (int) $contact['id'], 'ltv', array( 'order_id' => $order->get_id() ) );
			}
		}
	}

	/**
	 * @param int           $order_id Order id.
	 * @param WC_Order|null $order    Order.
	 */
	public static function order_completed( $order_id, $order = null ) {
		$order = $order ? $order : wc_get_order( $order_id );
		if ( ! $order || ! $order->get_billing_email() ) {
			return;
		}
		$workflows = Noonfy_Workflows::live_by_trigger( 'order_completed' );
		if ( ! $workflows ) {
			return;
		}
		$contact_id = Noonfy_Contacts::upsert_from_order( $order );
		foreach ( $workflows as $wf ) {
			$s = Noonfy_Workflows::trigger_node( $wf['graph'] )['settings'];
			if ( $contact_id && (float) $order->get_total() >= (float) $s['minTotal'] ) {
				Noonfy_Automation_Runner::enrol( $wf, $contact_id, 'order:' . $order->get_id(), array( 'order_id' => $order->get_id() ) );
			}
		}
	}

	/** Every five minutes: abandoned carts and abandoned browsing. */
	public static function scan() {
		self::scan_carts();
		self::scan_views();
	}

	/** Enrolls saved carts that haven't changed for each workflow's delay (carts up to 7 days old). */
	public static function scan_carts() {
		global $wpdb;
		$carts = Noonfy_Carts::table();
		$en    = Noonfy_Workflows::enrollments_table();
		foreach ( Noonfy_Workflows::live_by_trigger( 'cart_abandoned' ) as $wf ) {
			$s    = Noonfy_Workflows::trigger_node( $wf['graph'] )['settings'];
			$idle = time() - (int) $s['minutes'] * MINUTE_IN_SECONDS;
			// phpcs:ignore WordPress.DB
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT c.id, c.contact_id, c.hash, c.created_at FROM {$carts} c WHERE c.status = 'active' AND c.contact_id > 0 AND c.updated_at <= %s AND c.updated_at >= %s AND c.total >= %f AND NOT EXISTS (SELECT 1 FROM {$en} e WHERE e.workflow_id = %d AND e.contact_id = c.contact_id AND (e.status = 'active' OR e.ref IN ('', CONCAT('cart:', c.id, ':', LEFT(MD5(CONCAT(c.hash, c.created_at)), 12))))) LIMIT 200", gmdate( 'Y-m-d H:i:s', $idle ), gmdate( 'Y-m-d H:i:s', $idle - 7 * DAY_IN_SECONDS ), (float) $s['minTotal'], $wf['id'] ), ARRAY_A );
			foreach ( (array) $rows as $r ) {
				Noonfy_Automation_Runner::enrol( $wf, (int) $r['contact_id'], self::cart_ref( $r ), array( 'cart_id' => (int) $r['id'] ) );
			}
		}
	}

	/**
	 * @param array $cart Cart row (id, hash, created_at).
	 * @return string Identifies one abandoned cart (a new cart after an order gets a new ref).
	 */
	public static function cart_ref( array $cart ) {
		return 'cart:' . $cart['id'] . ':' . substr( md5( $cart['hash'] . $cart['created_at'] ), 0, 12 );
	}

	/**
	 * Enrolls signed-in shoppers who viewed products N hours ago (within a day's window) without adding
	 * them to their cart or ordering since. At most one trip per shopper per day.
	 */
	public static function scan_views() {
		global $wpdb;
		$views = Noonfy_Carts::views_table();
		$carts = Noonfy_Carts::table();
		foreach ( Noonfy_Workflows::live_by_trigger( 'browse_abandoned' ) as $wf ) {
			$s     = Noonfy_Workflows::trigger_node( $wf['graph'] )['settings'];
			$until = time() - (int) $s['hours'] * HOUR_IN_SECONDS;
			$since = $until - DAY_IN_SECONDS;
			// phpcs:ignore WordPress.DB
			$users = $wpdb->get_col( $wpdb->prepare( "SELECT DISTINCT user_id FROM {$views} WHERE viewed_at <= %s AND viewed_at >= %s LIMIT 200", gmdate( 'Y-m-d H:i:s', $until ), gmdate( 'Y-m-d H:i:s', $since ) ) );
			foreach ( (array) $users as $user_id ) {
				$user = get_userdata( (int) $user_id );
				if ( ! $user ) {
					continue;
				}
				// phpcs:ignore WordPress.DB
				$rows = $wpdb->get_results( $wpdb->prepare( "SELECT product_id, viewed_at FROM {$views} WHERE user_id = %d AND viewed_at <= %s AND viewed_at >= %s ORDER BY viewed_at DESC", $user_id, gmdate( 'Y-m-d H:i:s', $until ), gmdate( 'Y-m-d H:i:s', $since ) ), ARRAY_A );
				$cart = $wpdb->get_var( $wpdb->prepare( "SELECT items FROM {$carts} WHERE user_id = %d AND status = 'active' ORDER BY updated_at DESC LIMIT 1", $user_id ) ); // phpcs:ignore WordPress.DB
				$in   = $cart ? Noonfy_Carts::product_ids( array( 'items' => $cart ) ) : array();
				$ids  = array_values( array_diff( array_map( 'intval', wp_list_pluck( $rows, 'product_id' ) ), $in ) );
				if ( ! $ids ) {
					continue;
				}
				$contact = Noonfy_Contacts::by_email( $user->user_email );
				$first   = end( $rows )['viewed_at'];
				if ( $contact && $contact['last_order_at'] && $contact['last_order_at'] >= $first ) {
					continue; // Ordered since.
				}
				$contact_id = $contact ? (int) $contact['id'] : Noonfy_Contacts::upsert( $user->user_email, array( 'user_id' => $user->ID, 'first_name' => $user->first_name, 'last_name' => $user->last_name, 'source' => 'account' ) );
				if ( $contact_id ) {
					Noonfy_Automation_Runner::enrol( $wf, (int) $contact_id, 'browse:' . substr( $rows[0]['viewed_at'], 0, 10 ), array( 'product_ids' => array_slice( $ids, 0, 4 ) ) );
				}
			}
		}
	}

	/** Daily: lapsed customers, lifetime spend reached (e.g. after a customer sync), housekeeping. */
	public static function daily() {
		global $wpdb;
		$contacts = Noonfy_Contacts::table();
		$en       = Noonfy_Workflows::enrollments_table();
		foreach ( Noonfy_Workflows::live_by_trigger( 'no_order' ) as $wf ) {
			$s = Noonfy_Workflows::trigger_node( $wf['graph'] )['settings'];
			// phpcs:ignore WordPress.DB
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT c.id, c.last_order_at FROM {$contacts} c WHERE c.orders_count >= 1 AND c.marketing <> 'unsubscribed' AND c.last_order_at <= %s AND NOT EXISTS (SELECT 1 FROM {$en} e WHERE e.workflow_id = %d AND e.contact_id = c.id AND (e.status = 'active' OR e.ref IN ('', CONCAT('lapse:', DATE_FORMAT(c.last_order_at, '%%Y-%%m-%%d'))))) LIMIT 500", gmdate( 'Y-m-d H:i:s', time() - (int) $s['days'] * DAY_IN_SECONDS ), $wf['id'] ), ARRAY_A );
			foreach ( (array) $rows as $r ) {
				Noonfy_Automation_Runner::enrol( $wf, (int) $r['id'], 'lapse:' . substr( $r['last_order_at'], 0, 10 ) );
			}
		}
		foreach ( Noonfy_Workflows::live_by_trigger( 'lifetime_spend' ) as $wf ) {
			$s = Noonfy_Workflows::trigger_node( $wf['graph'] )['settings'];
			// phpcs:ignore WordPress.DB
			$ids = $wpdb->get_col( $wpdb->prepare( "SELECT c.id FROM {$contacts} c WHERE c.total_spent >= %f AND c.marketing <> 'unsubscribed' AND NOT EXISTS (SELECT 1 FROM {$en} e WHERE e.workflow_id = %d AND e.contact_id = c.id) LIMIT 500", (float) $s['amount'], $wf['id'] ) );
			foreach ( (array) $ids as $id ) {
				Noonfy_Automation_Runner::enrol( $wf, (int) $id, 'ltv' );
			}
		}
		Noonfy_Carts::purge();
	}

	/**
	 * Enrolls everyone in the workflow's segment who isn't in it already (one trip per contact).
	 * The segment applies the store's audience rules, so only contacts who may get marketing email join.
	 *
	 * @param int $id Workflow id.
	 * @return int|WP_Error Contacts enrolled.
	 */
	public static function enrol_segment( $id ) {
		global $wpdb;
		$wf = Noonfy_Workflows::get( $id );
		if ( ! $wf || 'segment' !== $wf['trigger_type'] ) {
			return new WP_Error( 'noonfy_bad_trigger', __( 'This workflow isn’t started from a segment.', 'noonfy' ), array( 'status' => 400 ) );
		}
		if ( 'live' !== $wf['status'] ) {
			return new WP_Error( 'noonfy_bad_state', __( 'Activate the workflow first.', 'noonfy' ), array( 'status' => 409 ) );
		}
		$trigger  = Noonfy_Workflows::trigger_node( $wf['graph'] );
		$contacts = Noonfy_Contacts::table();
		$en       = Noonfy_Workflows::enrollments_table();
		$ev       = Noonfy_Workflows::events_table();
		$where    = Noonfy_Contacts::segment_where( $trigger['settings']['segment'] );
		$now      = gmdate( 'Y-m-d H:i:s' );
		$before   = (int) $wpdb->get_var( "SELECT COALESCE(MAX(id), 0) FROM {$en}" ); // phpcs:ignore WordPress.DB
		// phpcs:disable WordPress.DB
		$added = (int) $wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$en} (workflow_id, contact_id, email, ref, status, node_id, next_run_at, context, entered_at, updated_at) SELECT %d, c.id, c.email, '', 'active', %s, %s, '{}', %s, %s FROM {$contacts} c WHERE {$where} AND NOT EXISTS (SELECT 1 FROM {$en} e WHERE e.workflow_id = %d AND e.contact_id = c.id AND e.status = 'active')", $id, $trigger['id'], $now, $now, $now, $id ) );
		$wpdb->query( $wpdb->prepare( "INSERT INTO {$ev} (workflow_id, enrollment_id, node_id, action, created_at) SELECT workflow_id, id, node_id, 'enter', %s FROM {$en} WHERE workflow_id = %d AND id > %d", $now, $id, $before ) );
		// phpcs:enable
		if ( $added ) {
			Noonfy_Automation_Runner::queue();
		}
		return $added;
	}
}
