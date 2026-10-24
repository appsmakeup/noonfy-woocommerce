<?php
/**
 * Contacts: who campaigns can be sent to.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * One row per email address.
 *
 * `marketing` is the consent state: 'subscribed' (opted in, or imported with the store's confirmation of
 * consent), 'none' (a customer who never opted in) or 'unsubscribed' (never send marketing again).
 * Whether 'none' contacts are eligible depends on the store's audience mode (Noonfy_Campaign_Settings).
 */
class Noonfy_Contacts {

	const MARKETING = array( 'subscribed', 'none', 'unsubscribed' );

	/** Audience segments, keyed by id. */
	const SEGMENTS = array(
		'all'        => 'All contacts',
		'customers'  => 'Customers (1+ orders)',
		'repeat'     => 'Repeat customers (2+ orders)',
		'recent'     => 'Ordered in the last 30 days',
		'lapsed'     => 'No order in 90+ days',
		'leads'      => 'Never ordered',
		'engaged_30' => 'Engaged in the last 30 days',
	);

	/** @return string */
	public static function table() {
		global $wpdb;
		return $wpdb->prefix . 'noonfy_contacts';
	}

	/** Creates or upgrades the table (called by Noonfy_Install). */
	public static function create_table() {
		global $wpdb;
		$table   = self::table();
		$charset = $wpdb->get_charset_collate();
		dbDelta(
			"CREATE TABLE {$table} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				email varchar(190) NOT NULL,
				first_name varchar(100) NOT NULL DEFAULT '',
				last_name varchar(100) NOT NULL DEFAULT '',
				marketing varchar(12) NOT NULL DEFAULT 'none',
				source varchar(20) NOT NULL DEFAULT '',
				user_id bigint(20) unsigned NOT NULL DEFAULT 0,
				is_customer tinyint(1) NOT NULL DEFAULT 0,
				orders_count int(10) unsigned NOT NULL DEFAULT 0,
				total_spent decimal(14,2) NOT NULL DEFAULT 0,
				last_order_at datetime DEFAULT NULL,
				token char(32) NOT NULL,
				consent_at datetime DEFAULT NULL,
				unsubscribed_at datetime DEFAULT NULL,
				created_at datetime NOT NULL,
				updated_at datetime NOT NULL,
				PRIMARY KEY  (id),
				UNIQUE KEY email (email),
				UNIQUE KEY token (token),
				KEY marketing (marketing)
			) {$charset};"
		);
	}

	/**
	 * Creates or updates a contact by email. Consent only ever moves forward by explicit action:
	 * `optin` subscribes, `marketing` sets a state directly (used by the unsubscribe page and imports).
	 *
	 * @param string $email Address.
	 * @param array  $data  first_name, last_name, user_id, source, is_customer, optin (bool), marketing.
	 * @return int|false Contact id.
	 */
	public static function upsert( $email, array $data = array() ) {
		global $wpdb;
		$email = strtolower( trim( sanitize_email( $email ) ) );
		if ( ! is_email( $email ) ) {
			return false;
		}
		$table    = self::table();
		$now      = gmdate( 'Y-m-d H:i:s' );
		$existing = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE email = %s", $email ), ARRAY_A ); // phpcs:ignore WordPress.DB

		$row = array( 'updated_at' => $now );
		foreach ( array( 'first_name', 'last_name' ) as $k ) {
			if ( ! empty( $data[ $k ] ) ) {
				$row[ $k ] = mb_substr( sanitize_text_field( $data[ $k ] ), 0, 100 );
			}
		}
		if ( ! empty( $data['user_id'] ) ) {
			$row['user_id'] = (int) $data['user_id'];
		}
		if ( ! empty( $data['is_customer'] ) ) {
			$row['is_customer'] = 1;
		}
		if ( ! empty( $data['optin'] ) ) {
			$row['marketing']  = 'subscribed';
			$row['consent_at'] = $now;
		}
		if ( isset( $data['marketing'] ) && in_array( $data['marketing'], self::MARKETING, true ) ) {
			$row['marketing'] = $data['marketing'];
			if ( 'subscribed' === $data['marketing'] ) {
				$row['consent_at'] = $now;
			}
			$row['unsubscribed_at'] = 'unsubscribed' === $data['marketing'] ? $now : null;
		}

		if ( $existing ) {
			$wpdb->update( $table, $row, array( 'id' => $existing['id'] ) ); // phpcs:ignore WordPress.DB
			self::changed( (int) $existing['id'], $existing['marketing'], $row['marketing'] ?? $existing['marketing'] );
			return (int) $existing['id'];
		}

		$row += array(
			'email'      => $email,
			'source'     => isset( $data['source'] ) ? mb_substr( (string) $data['source'], 0, 20 ) : '',
			'token'      => self::new_token(),
			'created_at' => $now,
			'marketing'  => 'none',
		);
		$wpdb->insert( $table, $row ); // phpcs:ignore WordPress.DB
		$id = (int) $wpdb->insert_id;
		self::changed( $id, 'none', $row['marketing'] );
		return $id;
	}

	/**
	 * Announces consent changes (automations start welcome flows and stop on unsubscribe).
	 *
	 * @param int    $id   Contact id.
	 * @param string $from Previous state.
	 * @param string $to   New state.
	 */
	private static function changed( $id, $from, $to ) {
		if ( $id && $from !== $to && 'subscribed' === $to ) {
			do_action( 'noonfy_contact_subscribed', $id );
		} elseif ( $id && $from !== $to && 'unsubscribed' === $to ) {
			do_action( 'noonfy_contact_unsubscribed', $id );
		}
	}

	/** @return string 32 random hex characters. */
	private static function new_token() {
		return bin2hex( random_bytes( 16 ) );
	}

	/**
	 * @param string $token Unsubscribe token.
	 * @return array|null Contact row.
	 */
	public static function by_token( $token ) {
		global $wpdb;
		if ( ! preg_match( '/^[a-f0-9]{32}$/', (string) $token ) ) {
			return null;
		}
		$table = self::table();
		return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE token = %s", $token ), ARRAY_A ); // phpcs:ignore WordPress.DB
	}

	/**
	 * @param string $email Address.
	 * @return array|null Contact row.
	 */
	public static function by_email( $email ) {
		global $wpdb;
		$table = self::table();
		return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE email = %s", strtolower( trim( (string) $email ) ) ), ARRAY_A ); // phpcs:ignore WordPress.DB
	}

	/**
	 * @param int    $id        Contact id.
	 * @param string $marketing New consent state.
	 */
	public static function set_marketing( $id, $marketing ) {
		global $wpdb;
		if ( ! in_array( $marketing, self::MARKETING, true ) ) {
			return;
		}
		$now  = gmdate( 'Y-m-d H:i:s' );
		$from = (string) $wpdb->get_var( $wpdb->prepare( 'SELECT marketing FROM ' . self::table() . ' WHERE id = %d', (int) $id ) ); // phpcs:ignore WordPress.DB
		$wpdb->update( // phpcs:ignore WordPress.DB
			self::table(),
			array(
				'marketing'       => $marketing,
				'unsubscribed_at' => 'unsubscribed' === $marketing ? $now : null,
				'consent_at'      => 'subscribed' === $marketing ? $now : null,
				'updated_at'      => $now,
			),
			array( 'id' => (int) $id )
		);
		self::changed( (int) $id, $from, $marketing );
	}

	/**
	 * Adds one order to a contact's purchase stats.
	 *
	 * @param int    $id      Contact id.
	 * @param float  $total   Order total.
	 * @param string $created Order date (UTC, Y-m-d H:i:s).
	 */
	public static function add_order( $id, $total, $created ) {
		global $wpdb;
		$table = self::table();
		// phpcs:ignore WordPress.DB
		$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET orders_count = orders_count + 1, total_spent = total_spent + %f, is_customer = 1, last_order_at = GREATEST(COALESCE(last_order_at, %s), %s) WHERE id = %d", (float) $total, $created, $created, (int) $id ) );
	}

	/**
	 * SQL condition (on alias `c`) for contacts eligible to receive campaigns in a segment.
	 *
	 * @param string $segment Segment id.
	 * @return string
	 */
	public static function segment_where( $segment ) {
		global $wpdb;
		$recipients = Noonfy_Campaigns::recipients_table();
		$base       = 'optin' === Noonfy_Campaign_Settings::get()['audienceMode']
			? "c.marketing = 'subscribed'"
			: "(c.marketing = 'subscribed' OR (c.marketing = 'none' AND c.is_customer = 1))";
		$d30        = gmdate( 'Y-m-d H:i:s', time() - 30 * DAY_IN_SECONDS );
		$d90        = gmdate( 'Y-m-d H:i:s', time() - 90 * DAY_IN_SECONDS );

		switch ( $segment ) {
			case 'customers':
				return "{$base} AND c.orders_count >= 1";
			case 'repeat':
				return "{$base} AND c.orders_count >= 2";
			case 'recent':
				return $wpdb->prepare( "{$base} AND c.last_order_at >= %s", $d30 ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			case 'lapsed':
				return $wpdb->prepare( "{$base} AND c.orders_count >= 1 AND c.last_order_at < %s", $d90 ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			case 'leads':
				return "{$base} AND c.orders_count = 0";
			case 'engaged_30':
				return $wpdb->prepare( "{$base} AND EXISTS (SELECT 1 FROM {$recipients} r WHERE r.contact_id = c.id AND (r.opened_at >= %s OR r.clicked_at >= %s))", $d30, $d30 ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			default:
				return $base;
		}
	}

	/** @return array[] Segments with labels and current counts. */
	public static function segments() {
		global $wpdb;
		$table = self::table();
		$out   = array();
		foreach ( self::SEGMENTS as $id => $label ) {
			if ( 'all' === $id && 'optin' === Noonfy_Campaign_Settings::get()['audienceMode'] ) {
				$label = 'All subscribers';
			}
			$where = self::segment_where( $id );
			$out[] = array(
				'id'    => $id,
				'label' => $label,
				'count' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} c WHERE {$where}" ), // phpcs:ignore WordPress.DB
			);
		}
		return $out;
	}

	/** @return array{subscribed:int, customersNotOptedIn:int, unsubscribed:int, total:int} */
	public static function summary() {
		global $wpdb;
		$table = self::table();
		$row   = $wpdb->get_row( "SELECT COUNT(*) AS total, SUM(marketing = 'subscribed') AS subscribed, SUM(marketing = 'none' AND is_customer = 1) AS customers, SUM(marketing = 'unsubscribed') AS unsubscribed FROM {$table}", ARRAY_A ); // phpcs:ignore WordPress.DB
		return array(
			'subscribed'          => (int) $row['subscribed'],
			'customersNotOptedIn' => (int) $row['customers'],
			'unsubscribed'        => (int) $row['unsubscribed'],
			'total'               => (int) $row['total'],
		);
	}

	/**
	 * One page of the WooCommerce customer backfill. Page 1 resets purchase stats; each page adds 200
	 * orders. Registered customers without orders are added on the last page.
	 *
	 * @param int  $page      1-based page.
	 * @param bool $subscribe Mark synced contacts as subscribed (store confirmed it has consent).
	 * @return array{processed:int, done:bool, nextPage:int}
	 */
	public static function sync_customers( $page, $subscribe ) {
		global $wpdb;
		if ( ! function_exists( 'wc_get_orders' ) ) {
			return array( 'processed' => 0, 'done' => true, 'nextPage' => 0 );
		}
		$table = self::table();
		if ( 1 === $page ) {
			$wpdb->query( "UPDATE {$table} SET orders_count = 0, total_spent = 0, last_order_at = NULL" ); // phpcs:ignore WordPress.DB
		}

		$orders = wc_get_orders(
			array(
				'limit'   => 200,
				'page'    => $page,
				'type'    => 'shop_order',
				'status'  => array_keys( wc_get_order_statuses() ),
				'orderby' => 'ID',
				'order'   => 'ASC',
			)
		);
		foreach ( $orders as $order ) {
			$id = self::upsert_from_order( $order );
			if ( $id && $order->is_paid() ) {
				self::add_order( $id, (float) $order->get_total(), self::order_date_utc( $order ) );
			}
		}

		$done = count( $orders ) < 200;
		if ( $done ) {
			foreach ( get_users( array( 'role__in' => array( 'customer' ), 'fields' => array( 'ID', 'user_email', 'display_name' ) ) ) as $user ) {
				self::upsert( $user->user_email, array( 'user_id' => $user->ID, 'source' => 'customer', 'is_customer' => 1 ) );
			}
			if ( $subscribe ) {
				// Only contacts who are customers and haven't unsubscribed.
				$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET marketing = 'subscribed', consent_at = %s, source = IF(source = '', 'import', source) WHERE marketing = 'none' AND is_customer = 1", gmdate( 'Y-m-d H:i:s' ) ) ); // phpcs:ignore WordPress.DB
			}
		}
		return array(
			'processed' => count( $orders ),
			'done'      => $done,
			'nextPage'  => $done ? 0 : $page + 1,
		);
	}

	/**
	 * Creates/updates the contact behind a WooCommerce order (billing email and name).
	 *
	 * @param WC_Order $order Order.
	 * @param array    $extra optin (bool) to subscribe.
	 * @return int|false Contact id.
	 */
	public static function upsert_from_order( $order, array $extra = array() ) {
		$email = $order->get_billing_email();
		if ( ! $email ) {
			return false;
		}
		return self::upsert(
			$email,
			array(
				'first_name'  => $order->get_billing_first_name(),
				'last_name'   => $order->get_billing_last_name(),
				'user_id'     => $order->get_customer_id(),
				'source'      => 'checkout',
				'is_customer' => 1,
				'optin'       => ! empty( $extra['optin'] ),
			)
		);
	}

	/**
	 * @param WC_Order $order Order.
	 * @return string Creation date in UTC.
	 */
	public static function order_date_utc( $order ) {
		$created = $order->get_date_created();
		return $created ? gmdate( 'Y-m-d H:i:s', $created->getTimestamp() ) : gmdate( 'Y-m-d H:i:s' );
	}
}
