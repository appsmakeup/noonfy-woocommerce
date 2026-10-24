<?php
/**
 * Email log table: writes, queries and dashboard statistics.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * One row per send attempt made through wp_mail().
 *
 * Status is SENT (accepted by the mail server), RETRY (failed, another connection was tried next)
 * or FAILED (no connection could send it). Times are stored in UTC.
 */
class Noonfy_Email_Log {

	const STATUSES          = array( 'SENT', 'RETRY', 'FAILED' );

	/** @return string */
	public static function table() {
		global $wpdb;
		return $wpdb->prefix . 'noonfy_email_log';
	}

	/** Creates or upgrades the table (called by Noonfy_Install). */
	public static function create_table() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$table   = self::table();
		$charset = $wpdb->get_charset_collate();
		dbDelta(
			"CREATE TABLE {$table} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				created_at datetime NOT NULL,
				to_email varchar(255) NOT NULL DEFAULT '',
				subject varchar(255) NOT NULL DEFAULT '',
				connection_id varchar(32) NOT NULL DEFAULT '',
				provider varchar(32) NOT NULL DEFAULT '',
				connection_name varchar(100) NOT NULL DEFAULT '',
				status varchar(10) NOT NULL,
				attempt tinyint(3) unsigned NOT NULL DEFAULT 1,
				latency_ms int(10) unsigned DEFAULT NULL,
				error text,
				PRIMARY KEY  (id),
				KEY created_at (created_at),
				KEY status_created (status, created_at),
				KEY connection_created (connection_id, created_at)
			) {$charset};"
		);
	}

	/**
	 * @param array $row to, subject, connectionId, provider, connectionName, status, attempt, latencyMs, error.
	 */
	public static function insert( array $row ) {
		global $wpdb;
		$wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			self::table(),
			array(
				'created_at'      => gmdate( 'Y-m-d H:i:s' ),
				'to_email'        => mb_substr( (string) $row['to'], 0, 255 ),
				'subject'         => mb_substr( (string) $row['subject'], 0, 255 ),
				'connection_id'   => (string) $row['connectionId'],
				'provider'        => (string) $row['provider'],
				'connection_name' => mb_substr( (string) $row['connectionName'], 0, 100 ),
				'status'          => $row['status'],
				'attempt'         => (int) $row['attempt'],
				'latency_ms'      => null === $row['latencyMs'] ? null : (int) $row['latencyMs'],
				'error'           => $row['error'],
			),
			array( '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%d', '%s' )
		);
	}

	/**
	 * Log rows, newest first.
	 *
	 * @param array $args status, connectionId, search, before (id), after (id), limit.
	 * @return array{rows: array[], total: int}
	 */
	public static function query( array $args ) {
		global $wpdb;
		$table = self::table();
		$where = array( '1=1' );
		$vals  = array();

		if ( ! empty( $args['status'] ) && in_array( $args['status'], self::STATUSES, true ) ) {
			$where[] = 'status = %s';
			$vals[]  = $args['status'];
		}
		if ( ! empty( $args['connectionId'] ) ) {
			$where[] = 'connection_id = %s';
			$vals[]  = (string) $args['connectionId'];
		}
		if ( isset( $args['search'] ) && '' !== trim( (string) $args['search'] ) ) {
			$like    = '%' . $wpdb->esc_like( trim( (string) $args['search'] ) ) . '%';
			$where[] = '(to_email LIKE %s OR subject LIKE %s)';
			$vals[]  = $like;
			$vals[]  = $like;
		}
		$filter_sql = implode( ' AND ', $where );
		$filter_val = $vals;

		if ( ! empty( $args['before'] ) ) {
			$where[] = 'id < %d';
			$vals[]  = (int) $args['before'];
		}
		if ( ! empty( $args['after'] ) ) {
			$where[] = 'id > %d';
			$vals[]  = (int) $args['after'];
		}
		$limit  = max( 1, min( 100, (int) ( $args['limit'] ?? 25 ) ) );
		$vals[] = $limit;

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
		$rows  = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} WHERE " . implode( ' AND ', $where ) . ' ORDER BY id DESC LIMIT %d', $vals ), ARRAY_A );
		$count = "SELECT COUNT(*) FROM {$table} WHERE {$filter_sql}";
		$total = (int) $wpdb->get_var( $filter_val ? $wpdb->prepare( $count, $filter_val ) : $count );
		// phpcs:enable

		return array(
			'rows'  => array_map( array( __CLASS__, 'to_public' ), (array) $rows ),
			'total' => $total,
		);
	}

	/**
	 * @param array $r DB row.
	 * @return array Browser shape.
	 */
	private static function to_public( array $r ) {
		return array(
			'id'             => (int) $r['id'],
			'time'           => gmdate( 'c', strtotime( $r['created_at'] . ' UTC' ) ),
			'to'             => $r['to_email'],
			'subject'        => $r['subject'],
			'connectionId'   => $r['connection_id'],
			'provider'       => $r['provider'],
			'connectionName' => $r['connection_name'],
			'status'         => $r['status'],
			'attempt'        => (int) $r['attempt'],
			'latencyMs'      => null === $r['latency_ms'] ? null : (int) $r['latency_ms'],
			'error'          => $r['error'],
		);
	}

	/**
	 * Start of a local (site timezone) day, as a UTC datetime string.
	 *
	 * @param string $relative e.g. 'today', 'yesterday', 'first day of this month', '-13 days'.
	 * @return string
	 */
	private static function local_day_start_utc( $relative ) {
		$day = new DateTimeImmutable( $relative, wp_timezone() );
		return $day->setTime( 0, 0 )->setTimezone( new DateTimeZone( 'UTC' ) )->format( 'Y-m-d H:i:s' );
	}

	/**
	 * Successful sends today per connection (for daily limits).
	 *
	 * @return array<string, int>
	 */
	public static function sent_today_by_connection() {
		global $wpdb;
		$table = self::table();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT connection_id, COUNT(*) AS n FROM {$table} WHERE status = 'SENT' AND created_at >= %s GROUP BY connection_id", self::local_day_start_utc( 'today' ) ), ARRAY_A );
		$out  = array();
		foreach ( (array) $rows as $r ) {
			$out[ $r['connection_id'] ] = (int) $r['n'];
		}
		return $out;
	}

	/**
	 * Per-connection send time and success rate over recent days (for routing).
	 *
	 * @param int $days Window.
	 * @return array<string, array{avgLatency: ?int, successRate: ?float, attempts: int}>
	 */
	public static function performance_by_connection( $days = 7 ) {
		global $wpdb;
		$table = self::table();
		$since = gmdate( 'Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT connection_id, COUNT(*) AS attempts, SUM(status = 'SENT') AS sent, AVG(CASE WHEN status = 'SENT' THEN latency_ms END) AS avg_latency FROM {$table} WHERE created_at >= %s AND connection_id <> '' GROUP BY connection_id", $since ), ARRAY_A );
		$out  = array();
		foreach ( (array) $rows as $r ) {
			$attempts                   = (int) $r['attempts'];
			$out[ $r['connection_id'] ] = array(
				'attempts'    => $attempts,
				'avgLatency'  => null === $r['avg_latency'] ? null : (int) round( (float) $r['avg_latency'] ),
				'successRate' => $attempts ? round( 100 * (int) $r['sent'] / $attempts, 1 ) : null,
			);
		}
		return $out;
	}

	/** @return array Dashboard statistics. */
	public static function stats() {
		global $wpdb;
		$table     = self::table();
		$today     = self::local_day_start_utc( 'today' );
		$yesterday = self::local_day_start_utc( 'yesterday' );
		$month     = self::local_day_start_utc( 'first day of this month' );
		$start14   = self::local_day_start_utc( '-13 days' );
		$since30   = gmdate( 'Y-m-d H:i:s', time() - 30 * DAY_IN_SECONDS );
		$since7    = gmdate( 'Y-m-d H:i:s', time() - 7 * DAY_IN_SECONDS );
		$hour      = gmdate( 'Y-m-d H:i:s', time() - HOUR_IN_SECONDS );

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
		$counts = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT
					SUM(status = 'SENT' AND created_at >= %s) AS sent_today,
					SUM(status = 'FAILED' AND created_at >= %s) AS failed_today,
					SUM(status = 'RETRY' AND created_at >= %s) AS retried_today,
					SUM(status = 'SENT' AND created_at >= %s AND created_at < %s) AS sent_yesterday,
					SUM(status = 'SENT' AND created_at >= %s) AS sent_month,
					SUM(status = 'SENT' AND created_at >= %s) AS sent_30,
					SUM(status = 'FAILED' AND created_at >= %s) AS failed_30,
					SUM(status = 'SENT' AND created_at >= %s) AS last_hour
				FROM {$table}
				WHERE created_at >= %s",
				$today,
				$today,
				$today,
				$yesterday,
				$today,
				$month,
				$since30,
				$since30,
				$hour,
				min( $yesterday, $month, $since30 )
			),
			ARRAY_A
		);
		$total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" );

		$latencies = array_map( 'intval', (array) $wpdb->get_col( $wpdb->prepare( "SELECT latency_ms FROM {$table} WHERE status = 'SENT' AND latency_ms IS NOT NULL AND created_at >= %s ORDER BY latency_ms", $since7 ) ) );

		// Group by local calendar day using the site's current UTC offset.
		$offset = (int) wp_timezone()->getOffset( new DateTimeImmutable( 'now' ) );
		$daily  = $wpdb->get_results( $wpdb->prepare( "SELECT DATE(DATE_ADD(created_at, INTERVAL %d SECOND)) AS day, SUM(status = 'SENT') AS sent, SUM(status = 'FAILED') AS failed FROM {$table} WHERE created_at >= %s GROUP BY day", $offset, $start14 ), ARRAY_A );

		$share = $wpdb->get_results( $wpdb->prepare( "SELECT connection_id, provider, MAX(connection_name) AS name, COUNT(*) AS n FROM {$table} WHERE status = 'SENT' AND created_at >= %s GROUP BY connection_id, provider ORDER BY n DESC", $month ), ARRAY_A );

		$per_today = $wpdb->get_results( $wpdb->prepare( "SELECT connection_id, COUNT(*) AS n FROM {$table} WHERE status = 'SENT' AND created_at >= %s GROUP BY connection_id", $today ), ARRAY_A );
		// phpcs:enable

		$by_day = array();
		foreach ( (array) $daily as $d ) {
			$by_day[ $d['day'] ] = $d;
		}
		$volume = array();
		for ( $i = 13; $i >= 0; $i-- ) {
			$day      = new DateTimeImmutable( "-{$i} days", wp_timezone() );
			$key      = $day->format( 'Y-m-d' );
			$volume[] = array(
				'label'  => wp_date( 'M j', $day->getTimestamp() ),
				'sent'   => (int) ( $by_day[ $key ]['sent'] ?? 0 ),
				'failed' => (int) ( $by_day[ $key ]['failed'] ?? 0 ),
			);
		}

		$perf = self::performance_by_connection( 7 );
		foreach ( (array) $per_today as $r ) {
			$perf[ $r['connection_id'] ]['sentToday'] = (int) $r['n'];
		}

		$sent30   = (int) $counts['sent_30'];
		$failed30 = (int) $counts['failed_30'];
		$n        = count( $latencies );

		return array(
			'sentToday'     => (int) $counts['sent_today'],
			'failedToday'   => (int) $counts['failed_today'],
			'retriedToday'  => (int) $counts['retried_today'],
			'sentYesterday' => (int) $counts['sent_yesterday'],
			'sentMonth'     => (int) $counts['sent_month'],
			'lastHour'      => (int) $counts['last_hour'],
			'totalLogged'   => $total,
			'successRate30' => ( $sent30 + $failed30 ) ? round( 100 * $sent30 / ( $sent30 + $failed30 ), 1 ) : null,
			'failedRate30'  => ( $sent30 + $failed30 ) ? round( 100 * $failed30 / ( $sent30 + $failed30 ), 1 ) : null,
			'avgLatency7'   => $n ? (int) round( array_sum( $latencies ) / $n ) : null,
			'p95Latency7'   => $n ? $latencies[ (int) min( $n - 1, floor( 0.95 * $n ) ) ] : null,
			'volume14'      => $volume,
			'shareMonth'    => array_map(
				static function ( $r ) {
					return array(
						'connectionId' => $r['connection_id'],
						'provider'     => $r['provider'],
						'name'         => $r['name'],
						'count'        => (int) $r['n'],
					);
				},
				(array) $share
			),
			'perConnection' => (object) $perf,
		);
	}

	/**
	 * Deletes rows older than the retention period.
	 *
	 * @param int $days Days to keep.
	 */
	public static function purge( $days ) {
		global $wpdb;
		$table = self::table();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE created_at < %s", gmdate( 'Y-m-d H:i:s', time() - max( 1, (int) $days ) * DAY_IN_SECONDS ) ) );
	}

	/** Drops the table (uninstall). */
	public static function drop() {
		global $wpdb;
		$table = self::table();
		$wpdb->query( "DROP TABLE IF EXISTS {$table}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery, WordPress.DB.DirectDatabaseQuery.SchemaChange
	}
}
