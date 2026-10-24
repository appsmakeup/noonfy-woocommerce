<?php
/**
 * Campaign scheduling and batched sending.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Lifecycle: draft → scheduled → sending → sent (or paused / cancelled).
 *
 * Starting a campaign snapshots its audience into the recipients table. Batches then claim rows
 * (UPDATE … SET claim = token), send each with wp_mail() — so mail goes through Noonfy's SMTP routing —
 * and reschedule themselves via WP-Cron until nothing is left. A lock per campaign keeps two runs from
 * overlapping. Admin screens also nudge overdue work (tick()), so sending progresses on quiet sites.
 */
class Noonfy_Campaign_Sender {

	const START_HOOK  = 'noonfy_campaign_start';
	const BATCH_HOOK  = 'noonfy_campaign_batch';
	const DECIDE_HOOK = 'noonfy_campaign_decide';
	const TIME_LIMIT = 20;

	/** Hooks the cron events. */
	public static function init() {
		add_action( self::START_HOOK, array( __CLASS__, 'start' ) );
		add_action( self::BATCH_HOOK, array( __CLASS__, 'process' ) );
		add_action( self::DECIDE_HOOK, array( __CLASS__, 'decide' ) );
	}

	/**
	 * Schedules a campaign, or starts it now when `$when` is null or in the past.
	 *
	 * @param int      $id   Campaign id.
	 * @param int|null $when Unix time to send.
	 * @return array|WP_Error Campaign (browser shape).
	 */
	public static function schedule( $id, $when ) {
		$campaign = Noonfy_Campaigns::get( $id );
		if ( ! $campaign ) {
			return new WP_Error( 'noonfy_not_found', __( 'Campaign not found.', 'noonfy' ), array( 'status' => 404 ) );
		}
		if ( ! in_array( $campaign['status'], array( 'draft', 'scheduled' ), true ) ) {
			return new WP_Error( 'noonfy_locked', __( 'This campaign has already been sent.', 'noonfy' ), array( 'status' => 409 ) );
		}
		$problem = self::readiness_problem( $campaign );
		if ( $problem ) {
			return new WP_Error( 'noonfy_not_ready', $problem, array( 'status' => 400 ) );
		}

		wp_clear_scheduled_hook( self::START_HOOK, array( (int) $id ) );
		$when = $when && $when > time() ? (int) $when : time();
		Noonfy_Campaigns::set_status( $id, 'scheduled', array( 'scheduled_at' => gmdate( 'Y-m-d H:i:s', $when ) ) );

		if ( $when <= time() ) {
			self::start( $id );
		} else {
			wp_schedule_single_event( $when, self::START_HOOK, array( (int) $id ) );
		}
		return Noonfy_Campaigns::get_public( $id );
	}

	/**
	 * @param array $campaign Campaign row.
	 * @return string|null Why it can't be sent yet.
	 */
	public static function readiness_problem( array $campaign ) {
		if ( '' === trim( $campaign['subject'] ) ) {
			return __( 'Add a subject line first.', 'noonfy' );
		}
		if ( ! Noonfy_Mailer::is_routing_active() ) {
			return __( 'Connect an SMTP provider first (SMTP & Delivery → Connections). Campaigns aren’t sent with PHP mail().', 'noonfy' );
		}
		$count = self::audience_count( $campaign['segment'] );
		if ( 0 === $count ) {
			return __( 'This audience has no contacts yet.', 'noonfy' );
		}
		if ( Noonfy_Campaigns::is_ab( $campaign ) ) {
			if ( 'subject' === $campaign['ab']['type'] && '' === trim( $campaign['ab']['subjectB'] ) ) {
				return __( 'Add the variant B subject line for the A/B test.', 'noonfy' );
			}
			if ( $count < 4 ) {
				return __( 'An A/B test needs at least 4 contacts in the audience.', 'noonfy' );
			}
		}
		return null;
	}

	/**
	 * Unsaved builder content as one variant (for previews and test sends).
	 *
	 * @param array  $campaign subject, preheader, content, ab.
	 * @param string $variant  'A' or 'B'.
	 * @return array
	 */
	public static function with_ab( array $campaign, $variant ) {
		if ( 'B' !== $variant || empty( $campaign['ab']['enabled'] ) ) {
			return $campaign;
		}
		$ab               = (array) $campaign['ab'];
		$campaign['ab']   = array(
			'enabled'    => true,
			'type'       => 'content' === ( $ab['type'] ?? '' ) ? 'content' : 'subject',
			'subjectB'   => sanitize_text_field( (string) ( $ab['subjectB'] ?? '' ) ),
			'preheaderB' => sanitize_text_field( (string) ( $ab['preheaderB'] ?? '' ) ),
			'contentB'   => Noonfy_Campaigns::sanitize_content( $ab['contentB'] ?? array() ),
		);
		return Noonfy_Campaigns::for_variant( $campaign, 'B' );
	}

	/** @return string|null Why no SMTP connection can send right now. */
	public static function connection_problem() {
		if ( ! Noonfy_Mailer::is_routing_active() ) {
			return __( 'Connect an SMTP provider first (SMTP & Delivery → Connections). Campaigns aren’t sent with PHP mail().', 'noonfy' );
		}
		if ( ! Noonfy_Router::candidates() ) {
			return __( 'Every SMTP connection has reached its daily limit. Raise a limit or add a connection.', 'noonfy' );
		}
		return null;
	}

	/**
	 * The current admin as a contact, for previews and test sends.
	 *
	 * @param string $email Address to use.
	 * @return array first_name, last_name, email.
	 */
	public static function admin_contact( $email ) {
		$user  = wp_get_current_user();
		$first = $user->first_name ? $user->first_name : strtok( (string) $user->display_name, ' ' );
		return array( 'first_name' => (string) $first, 'last_name' => $user->last_name, 'email' => $email );
	}

	/**
	 * @param string $segment Segment id.
	 * @return int Eligible contacts.
	 */
	public static function audience_count( $segment ) {
		global $wpdb;
		$contacts = Noonfy_Contacts::table();
		$where    = Noonfy_Contacts::segment_where( $segment );
		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$contacts} c WHERE {$where}" ); // phpcs:ignore WordPress.DB
	}

	/**
	 * Snapshots the audience into recipients and begins sending.
	 *
	 * @param int $id Campaign id.
	 */
	public static function start( $id ) {
		global $wpdb;
		$campaign = Noonfy_Campaigns::get( $id );
		if ( ! $campaign || 'scheduled' !== $campaign['status'] ) {
			return;
		}
		$recipients = Noonfy_Campaigns::recipients_table();
		$contacts   = Noonfy_Contacts::table();
		$where      = Noonfy_Contacts::segment_where( $campaign['segment'] );
		// phpcs:ignore WordPress.DB
		$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$recipients} (campaign_id, contact_id, email) SELECT %d, c.id, c.email FROM {$contacts} c WHERE {$where}", (int) $id ) );
		$total = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$recipients} WHERE campaign_id = %d", (int) $id ) ); // phpcs:ignore WordPress.DB

		$extra = array(
			'started_at'       => gmdate( 'Y-m-d H:i:s' ),
			'recipients_total' => $total,
		);
		if ( Noonfy_Campaigns::is_ab( $campaign ) ) {
			self::split_test_group( $id, $total, (int) $campaign['ab']['testPct'] );
			$extra += array( 'ab_phase' => 'testing', 'ab_winner' => '' );
		}
		Noonfy_Campaigns::set_status( $id, 'sending', $extra );
		self::queue_batch( $id );
	}

	/**
	 * A/B test: a random test group (testPct of the audience, split evenly) is queued as variant A or B;
	 * everyone else is held until the winner is known.
	 *
	 * @param int $id    Campaign id.
	 * @param int $total Recipients.
	 * @param int $pct   Test group percentage.
	 */
	private static function split_test_group( $id, $total, $pct ) {
		global $wpdb;
		$table = Noonfy_Campaigns::recipients_table();
		$ids   = array_map( 'intval', (array) $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$table} WHERE campaign_id = %d", $id ) ) ); // phpcs:ignore WordPress.DB
		shuffle( $ids );
		$size = (int) max( 2, round( $total * $pct / 100 ) );
		$size = min( $total, $size + ( $size % 2 ) );
		$half = (int) ( $size / 2 );

		$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET status = 'held', variant = 'A' WHERE campaign_id = %d", $id ) ); // phpcs:ignore WordPress.DB
		foreach ( array( 'A' => array_slice( $ids, 0, $half ), 'B' => array_slice( $ids, $half, $size - $half ) ) as $variant => $group ) {
			foreach ( array_chunk( $group, 500 ) as $chunk ) {
				$in = implode( ',', $chunk );
				$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET status = 'queued', variant = %s WHERE id IN ({$in})", $variant ) ); // phpcs:ignore WordPress.DB
			}
		}
	}

	/**
	 * Picks the A/B winner (by the campaign's metric, or `$forced`) and releases the held recipients to it.
	 *
	 * @param int         $id     Campaign id.
	 * @param string|null $forced 'A' or 'B' to choose manually.
	 * @return array|WP_Error Campaign (browser shape).
	 */
	public static function decide( $id, $forced = null ) {
		global $wpdb;
		$campaign = Noonfy_Campaigns::get( $id );
		if ( ! $campaign || ! Noonfy_Campaigns::is_ab( $campaign ) || ! in_array( $campaign['ab_phase'], array( 'testing', 'waiting' ), true ) ) {
			return new WP_Error( 'noonfy_bad_state', __( 'This campaign has no A/B test waiting for a winner.', 'noonfy' ), array( 'status' => 409 ) );
		}
		if ( ! $forced && 'sending' !== $campaign['status'] ) {
			return new WP_Error( 'noonfy_bad_state', __( 'Resume the campaign first.', 'noonfy' ), array( 'status' => 409 ) );
		}
		$winner = in_array( $forced, array( 'A', 'B' ), true ) ? $forced : self::leading_variant( $campaign );
		$table  = Noonfy_Campaigns::recipients_table();
		$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET status = 'queued', variant = %s WHERE campaign_id = %d AND status = 'held'", $winner, (int) $id ) ); // phpcs:ignore WordPress.DB
		wp_clear_scheduled_hook( self::DECIDE_HOOK, array( (int) $id ) );
		Noonfy_Campaigns::set_status(
			$id,
			$campaign['status'],
			array(
				'ab_phase'     => 'final',
				'ab_winner'    => $winner,
				'ab_decide_at' => gmdate( 'Y-m-d H:i:s' ),
			)
		);
		if ( 'sending' === $campaign['status'] ) {
			self::queue_batch( $id );
		}
		return Noonfy_Campaigns::get_public( $id );
	}

	/**
	 * @param array $campaign Campaign row.
	 * @return string 'A' or 'B' — higher rate per email sent on the campaign's metric (A on a tie).
	 */
	public static function leading_variant( array $campaign ) {
		global $wpdb;
		$table  = Noonfy_Campaigns::recipients_table();
		$metric = array(
			'opens'   => 'SUM(opened_at IS NOT NULL)',
			'clicks'  => 'SUM(clicked_at IS NOT NULL)',
			'revenue' => 'SUM(revenue)',
		)[ $campaign['ab']['metric'] ] ?? 'SUM(opened_at IS NOT NULL)';
		// phpcs:ignore WordPress.DB
		$rows  = $wpdb->get_results( $wpdb->prepare( "SELECT variant, COUNT(*) AS sent, {$metric} AS score FROM {$table} WHERE campaign_id = %d AND status = 'sent' GROUP BY variant", (int) $campaign['id'] ), ARRAY_A );
		$rates = array( 'A' => 0.0, 'B' => 0.0 );
		foreach ( (array) $rows as $r ) {
			$rates[ $r['variant'] ] = (int) $r['sent'] ? (float) $r['score'] / (int) $r['sent'] : 0.0;
		}
		return $rates['B'] > $rates['A'] ? 'B' : 'A';
	}

	/** @param int $id Campaign id. */
	private static function queue_batch( $id ) {
		if ( ! wp_next_scheduled( self::BATCH_HOOK, array( (int) $id ) ) ) {
			wp_schedule_single_event( time(), self::BATCH_HOOK, array( (int) $id ) );
		}
		if ( function_exists( 'spawn_cron' ) ) {
			spawn_cron();
		}
	}

	/**
	 * Sends queued recipients for up to TIME_LIMIT seconds, then reschedules itself.
	 *
	 * @param int $id         Campaign id.
	 * @param int $time_limit Seconds to spend.
	 */
	public static function process( $id, $time_limit = self::TIME_LIMIT ) {
		global $wpdb;
		$id = (int) $id;
		if ( ! self::lock( $id ) ) {
			return;
		}
		$recipients = Noonfy_Campaigns::recipients_table();
		$contacts   = Noonfy_Contacts::table();
		$started    = time();
		try {
			// Rows left mid-send by a crashed run go back in the queue (we hold the lock, so nothing else is sending).
			$wpdb->query( $wpdb->prepare( "UPDATE {$recipients} SET status = 'queued', claim = '' WHERE campaign_id = %d AND status = 'sending'", $id ) ); // phpcs:ignore WordPress.DB

			$batch_size = Noonfy_Campaign_Settings::get()['batchSize'];
			while ( time() - $started < $time_limit ) {
				$campaign = Noonfy_Campaigns::get( $id );
				if ( ! $campaign || 'sending' !== $campaign['status'] ) {
					return;
				}
				// Never fall back to PHP mail() for campaigns: if every connection is disabled or at its
				// daily limit, leave recipients queued and try again later.
				if ( ! Noonfy_Router::candidates() ) {
					wp_schedule_single_event( time() + 15 * MINUTE_IN_SECONDS, self::BATCH_HOOK, array( $id ) );
					return;
				}
				$claim = wp_generate_password( 16, false );
				// phpcs:ignore WordPress.DB
				$wpdb->query( $wpdb->prepare( "UPDATE {$recipients} SET status = 'sending', claim = %s WHERE campaign_id = %d AND status = 'queued' ORDER BY id LIMIT %d", $claim, $id, $batch_size ) );
				// phpcs:ignore WordPress.DB
				$rows = $wpdb->get_results( $wpdb->prepare( "SELECT r.id, r.email, r.variant, c.first_name, c.last_name, c.token, c.marketing, c.is_customer FROM {$recipients} r JOIN {$contacts} c ON c.id = r.contact_id WHERE r.claim = %s AND r.status = 'sending'", $claim ), ARRAY_A );
				if ( ! $rows ) {
					break;
				}
				foreach ( $rows as $row ) {
					self::send_one( $campaign, $row );
					if ( time() - $started >= $time_limit ) {
						// Out of time mid-batch: put this claim's unsent rows back for the next run.
						$wpdb->query( $wpdb->prepare( "UPDATE {$recipients} SET status = 'queued', claim = '' WHERE claim = %s AND status = 'sending'", $claim ) ); // phpcs:ignore WordPress.DB
						break 2;
					}
				}
			}

			if ( Noonfy_Campaigns::pending_count( $id ) > 0 ) {
				if ( ! wp_next_scheduled( self::BATCH_HOOK, array( $id ) ) ) {
					self::queue_batch( $id );
				}
			} else {
				$campaign = Noonfy_Campaigns::get( $id );
				if ( $campaign && 'sending' === $campaign['status'] ) {
					if ( Noonfy_Campaigns::held_count( $id ) > 0 ) {
						// A/B test group done: wait for results, then send the winner to everyone else.
						if ( 'testing' === $campaign['ab_phase'] ) {
							$at = time() + (int) $campaign['ab']['waitHours'] * HOUR_IN_SECONDS;
							Noonfy_Campaigns::set_status( $id, 'sending', array( 'ab_phase' => 'waiting', 'ab_decide_at' => gmdate( 'Y-m-d H:i:s', $at ) ) );
							wp_schedule_single_event( $at, self::DECIDE_HOOK, array( $id ) );
						}
					} else {
						Noonfy_Campaigns::set_status( $id, 'sent', array( 'finished_at' => gmdate( 'Y-m-d H:i:s' ) ) );
					}
				}
			}
		} finally {
			self::unlock( $id );
		}
	}

	/**
	 * @param array $campaign Campaign row.
	 * @param array $row      Recipient joined with contact.
	 */
	private static function send_one( array $campaign, array $row ) {
		global $wpdb;
		$table    = Noonfy_Campaigns::recipients_table();
		$campaign = Noonfy_Campaigns::for_variant( $campaign, $row['variant'] ?? 'A' );

		// Consent can change between scheduling and sending (e.g. an unsubscribe from a previous campaign).
		if ( 'unsubscribed' === $row['marketing'] || ( 'optin' === Noonfy_Campaign_Settings::get()['audienceMode'] && 'subscribed' !== $row['marketing'] ) ) {
			$wpdb->update( $table, array( 'status' => 'skipped', 'claim' => '' ), array( 'id' => $row['id'] ) ); // phpcs:ignore WordPress.DB
			return;
		}

		$rid     = (int) $row['id'];
		$unsub   = Noonfy_Tracking::unsubscribe_url( $row['token'] );
		$contact = array( 'first_name' => $row['first_name'], 'last_name' => $row['last_name'], 'email' => $row['email'] );
		$html    = Noonfy_Email_Renderer::render(
			$campaign,
			array(
				'contact'         => $contact,
				'unsubscribe_url' => $unsub,
				'pixel_url'       => Noonfy_Tracking::open_url( $rid ),
				'link'            => static function ( $url ) use ( $rid ) {
					return Noonfy_Tracking::click_url( $rid, $url );
				},
			)
		);

		$error   = '';
		$capture = static function ( $e ) use ( &$error ) {
			$error = $e->get_error_message();
		};
		add_action( 'wp_mail_failed', $capture );
		$sent = wp_mail(
			$row['email'],
			Noonfy_Email_Renderer::merge( $campaign['subject'], $contact ),
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
			$sent ? array( 'status' => 'sent', 'sent_at' => gmdate( 'Y-m-d H:i:s' ), 'claim' => '' ) : array( 'status' => 'failed', 'error' => mb_substr( $error, 0, 255 ), 'claim' => '' ),
			array( 'id' => $rid )
		);
	}

	/**
	 * Test send of (possibly unsaved) campaign content. Links aren't tracked.
	 *
	 * @param array  $campaign subject, preheader, content.
	 * @param string $to       Recipient.
	 * @return true|WP_Error
	 */
	public static function send_test( array $campaign, $to, $variant = 'A' ) {
		if ( ! is_email( $to ) ) {
			return new WP_Error( 'noonfy_bad_email', __( 'Enter a valid email address for the test.', 'noonfy' ), array( 'status' => 400 ) );
		}
		$problem = self::connection_problem();
		if ( $problem ) {
			return new WP_Error( 'noonfy_not_ready', $problem, array( 'status' => 400 ) );
		}
		$contact  = self::admin_contact( $to );
		$campaign = self::with_ab( $campaign, $variant );
		$html    = Noonfy_Email_Renderer::render( $campaign, array( 'contact' => $contact, 'unsubscribe_url' => home_url( '/' ) ) );
		$error   = '';
		$capture = static function ( $e ) use ( &$error ) {
			$error = $e->get_error_message();
		};
		add_action( 'wp_mail_failed', $capture );
		$sent = wp_mail( $to, '[Test] ' . Noonfy_Email_Renderer::merge( (string) $campaign['subject'], $contact ), $html, array( 'Content-Type: text/html; charset=UTF-8' ) );
		remove_action( 'wp_mail_failed', $capture );
		return $sent ? true : new WP_Error( 'noonfy_mail_failed', $error ? $error : __( 'The test email could not be sent.', 'noonfy' ), array( 'status' => 500 ) );
	}

	/**
	 * @param int $id Campaign id.
	 * @return array|WP_Error
	 */
	public static function pause( $id ) {
		return self::transition( $id, array( 'sending' ), 'paused' );
	}

	/**
	 * @param int $id Campaign id.
	 * @return array|WP_Error
	 */
	public static function resume( $id ) {
		$r = self::transition( $id, array( 'paused' ), 'sending' );
		if ( ! is_wp_error( $r ) ) {
			self::queue_batch( $id );
		}
		return $r;
	}

	/**
	 * A scheduled campaign goes back to draft; one that started sending stops for good.
	 *
	 * @param int $id Campaign id.
	 * @return array|WP_Error
	 */
	public static function cancel( $id ) {
		global $wpdb;
		$campaign = Noonfy_Campaigns::get( $id );
		if ( $campaign && 'scheduled' === $campaign['status'] ) {
			wp_clear_scheduled_hook( self::START_HOOK, array( (int) $id ) );
			return self::transition( $id, array( 'scheduled' ), 'draft', array( 'scheduled_at' => null ) );
		}
		$r = self::transition( $id, array( 'sending', 'paused' ), 'cancelled', array( 'finished_at' => gmdate( 'Y-m-d H:i:s' ) ) );
		if ( ! is_wp_error( $r ) ) {
			$table = Noonfy_Campaigns::recipients_table();
			$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET status = 'skipped', claim = '' WHERE campaign_id = %d AND status IN ('queued','sending','held')", (int) $id ) ); // phpcs:ignore WordPress.DB
			wp_clear_scheduled_hook( self::BATCH_HOOK, array( (int) $id ) );
			wp_clear_scheduled_hook( self::DECIDE_HOOK, array( (int) $id ) );
			$r = Noonfy_Campaigns::get_public( $id ); // Reflect the skipped recipients.
		}
		return $r;
	}

	/**
	 * @param int      $id    Campaign id.
	 * @param string[] $from  Allowed current statuses.
	 * @param string   $to    New status.
	 * @param array    $extra Other columns.
	 * @return array|WP_Error
	 */
	private static function transition( $id, array $from, $to, array $extra = array() ) {
		$campaign = Noonfy_Campaigns::get( $id );
		if ( ! $campaign ) {
			return new WP_Error( 'noonfy_not_found', __( 'Campaign not found.', 'noonfy' ), array( 'status' => 404 ) );
		}
		if ( ! in_array( $campaign['status'], $from, true ) ) {
			return new WP_Error( 'noonfy_bad_state', __( 'The campaign can’t do that in its current state.', 'noonfy' ), array( 'status' => 409 ) );
		}
		Noonfy_Campaigns::set_status( $id, $to, $extra );
		return Noonfy_Campaigns::get_public( $id );
	}

	/**
	 * Called when admin screens poll: starts due campaigns and runs a short batch for any sending
	 * campaign whose cron event is overdue, so progress doesn't depend on front-end traffic.
	 */
	public static function tick() {
		global $wpdb;
		$table = Noonfy_Campaigns::table();
		// phpcs:ignore WordPress.DB
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT id, status, scheduled_at, ab_phase, ab_decide_at FROM {$table} WHERE status = 'sending' OR (status = 'scheduled' AND scheduled_at <= %s)", gmdate( 'Y-m-d H:i:s' ) ), ARRAY_A );
		foreach ( (array) $rows as $r ) {
			if ( 'scheduled' === $r['status'] ) {
				self::start( (int) $r['id'] );
				continue;
			}
			if ( 'waiting' === $r['ab_phase'] ) {
				if ( $r['ab_decide_at'] && strtotime( $r['ab_decide_at'] . ' UTC' ) <= time() ) {
					self::decide( (int) $r['id'] );
				}
				continue;
			}
			$next = wp_next_scheduled( self::BATCH_HOOK, array( (int) $r['id'] ) );
			if ( ! $next || $next < time() - 30 ) {
				self::process( (int) $r['id'], 8 );
			}
		}
	}

	/**
	 * Atomic per-campaign lock (add_option fails if the row exists); stale locks expire after 2 minutes.
	 *
	 * @param int $id Campaign id.
	 * @return bool
	 */
	private static function lock( $id ) {
		$key = 'noonfy_campaign_lock_' . $id;
		if ( add_option( $key, time(), '', false ) ) {
			return true;
		}
		if ( (int) get_option( $key ) < time() - 120 ) {
			update_option( $key, time(), false );
			return true;
		}
		return false;
	}

	/** @param int $id Campaign id. */
	private static function unlock( $id ) {
		delete_option( 'noonfy_campaign_lock_' . $id );
	}
}
