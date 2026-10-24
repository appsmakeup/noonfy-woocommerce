<?php
/**
 * Campaigns and their recipients: storage, validation and stats.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Campaign content is a list of blocks (see BLOCK_TYPES), validated here and rendered to email HTML by
 * Noonfy_Email_Renderer. Each send creates one recipients row per contact, which also holds that
 * contact's opens, clicks and attributed revenue.
 */
class Noonfy_Campaigns {

	const STATUSES    = array( 'draft', 'scheduled', 'sending', 'paused', 'sent', 'cancelled' );
	const AB_WAITS    = array( 1, 2, 4, 8, 12, 24, 48 );
	const BLOCK_TYPES = array( 'header', 'image', 'text', 'products', 'button', 'countdown', 'reviews', 'coupon', 'footer' );
	const PRODUCT_SOURCES = array( 'manual', 'cart', 'order', 'viewed', 'cross_sells' );
	const EMOJIS      = array( '✉️', '🌾', '⚡', '🎁', '🏺', '🌷', '📦', '📖', '🏖️', '🛍️', '🎉', '❤️', '🔥', '⭐', '🎟️', '📣' );

	/** Inline HTML allowed in text blocks (edited in the builder). */
	const TEXT_TAGS = array(
		'a'      => array( 'href' => true ),
		'b'      => array(),
		'strong' => array(),
		'i'      => array(),
		'em'     => array(),
		'u'      => array(),
		'br'     => array(),
		'p'      => array(),
		'div'    => array(),
	);

	/** @return string */
	public static function table() {
		global $wpdb;
		return $wpdb->prefix . 'noonfy_campaigns';
	}

	/** @return string */
	public static function recipients_table() {
		global $wpdb;
		return $wpdb->prefix . 'noonfy_campaign_recipients';
	}

	/** Creates or upgrades both tables (called by Noonfy_Install). */
	public static function create_tables() {
		global $wpdb;
		$charset    = $wpdb->get_charset_collate();
		$campaigns  = self::table();
		$recipients = self::recipients_table();
		dbDelta(
			"CREATE TABLE {$campaigns} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				name varchar(190) NOT NULL DEFAULT '',
				subject varchar(255) NOT NULL DEFAULT '',
				preheader varchar(255) NOT NULL DEFAULT '',
				emoji varchar(16) NOT NULL DEFAULT '',
				segment varchar(20) NOT NULL DEFAULT 'all',
				status varchar(12) NOT NULL DEFAULT 'draft',
				content longtext NOT NULL,
				scheduled_at datetime DEFAULT NULL,
				started_at datetime DEFAULT NULL,
				finished_at datetime DEFAULT NULL,
				recipients_total int(10) unsigned NOT NULL DEFAULT 0,
				ab longtext,
				ab_phase varchar(10) NOT NULL DEFAULT '',
				ab_winner char(1) NOT NULL DEFAULT '',
				ab_decide_at datetime DEFAULT NULL,
				created_at datetime NOT NULL,
				updated_at datetime NOT NULL,
				PRIMARY KEY  (id),
				KEY status (status)
			) {$charset};"
		);
		dbDelta(
			"CREATE TABLE {$recipients} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				campaign_id bigint(20) unsigned NOT NULL,
				contact_id bigint(20) unsigned NOT NULL,
				email varchar(190) NOT NULL,
				variant char(1) NOT NULL DEFAULT 'A',
				status varchar(10) NOT NULL DEFAULT 'queued',
				claim char(16) NOT NULL DEFAULT '',
				sent_at datetime DEFAULT NULL,
				opened_at datetime DEFAULT NULL,
				open_count int(10) unsigned NOT NULL DEFAULT 0,
				clicked_at datetime DEFAULT NULL,
				click_count int(10) unsigned NOT NULL DEFAULT 0,
				order_id bigint(20) unsigned NOT NULL DEFAULT 0,
				revenue decimal(14,2) NOT NULL DEFAULT 0,
				error varchar(255) NOT NULL DEFAULT '',
				PRIMARY KEY  (id),
				UNIQUE KEY campaign_contact (campaign_id, contact_id),
				KEY campaign_status (campaign_id, status),
				KEY contact (contact_id),
				KEY email_sent (email, sent_at)
			) {$charset};"
		);
	}

	/**
	 * @param int $id Campaign id.
	 * @return array|null Raw row with decoded content.
	 */
	public static function get( $id ) {
		global $wpdb;
		$table = self::table();
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", (int) $id ), ARRAY_A ); // phpcs:ignore WordPress.DB
		if ( ! $row ) {
			return null;
		}
		$row['content'] = json_decode( $row['content'], true );
		if ( ! is_array( $row['content'] ) ) {
			$row['content'] = self::default_content();
		}
		$row['ab'] = self::decode_ab( $row['ab'] );
		return $row;
	}

	/**
	 * @param string|null $json Stored A/B config.
	 * @return array|null Config (enabled or not), null if never set.
	 */
	private static function decode_ab( $json ) {
		$ab = $json ? json_decode( $json, true ) : null;
		return is_array( $ab ) ? $ab : null;
	}

	/**
	 * @param array $campaign Campaign row.
	 * @return bool Whether it runs an A/B test.
	 */
	public static function is_ab( array $campaign ) {
		return ! empty( $campaign['ab']['enabled'] );
	}

	/**
	 * The campaign as variant B recipients receive it.
	 *
	 * @param array  $campaign Campaign row.
	 * @param string $variant  'A' or 'B'.
	 * @return array
	 */
	public static function for_variant( array $campaign, $variant ) {
		$ab = $campaign['ab'] ?? null;
		if ( 'B' !== $variant || ! self::is_ab( $campaign ) ) {
			return $campaign;
		}
		if ( 'content' === $ab['type'] ) {
			$campaign['content'] = $ab['contentB'];
		} else {
			$campaign['subject']   = $ab['subjectB'];
			$campaign['preheader'] = '' !== ( $ab['preheaderB'] ?? '' ) ? $ab['preheaderB'] : ( $campaign['preheader'] ?? '' );
		}
		return $campaign;
	}

	/** @return array[] All campaigns (browser shape, with stats), newest first. */
	public static function all_public() {
		global $wpdb;
		$table = self::table();
		$rows  = $wpdb->get_results( "SELECT * FROM {$table} ORDER BY COALESCE(finished_at, scheduled_at, updated_at) DESC, id DESC", ARRAY_A ); // phpcs:ignore WordPress.DB
		$stats = self::stats_by_campaign();
		return array_map(
			static function ( $row ) use ( $stats ) {
				$row['content'] = json_decode( $row['content'], true );
				$row['ab']      = self::decode_ab( $row['ab'] );
				return self::to_public( $row, $stats[ (int) $row['id'] ] ?? null );
			},
			(array) $rows
		);
	}

	/**
	 * @param int $id Campaign id.
	 * @return array|null Browser shape with stats.
	 */
	public static function get_public( $id ) {
		$row = self::get( $id );
		if ( ! $row ) {
			return null;
		}
		$stats = self::stats_by_campaign( (int) $id );
		return self::to_public( $row, $stats[ (int) $id ] ?? null );
	}

	/**
	 * Recipient aggregates per campaign.
	 *
	 * @param int $only Limit to one campaign id (0 = all).
	 * @return array<int, array>
	 */
	private static function stats_by_campaign( $only = 0 ) {
		global $wpdb;
		$table = self::recipients_table();
		$where = $only ? $wpdb->prepare( 'WHERE campaign_id = %d', $only ) : '';
		$agg   = "COUNT(*) AS total, SUM(status = 'sent') AS sent, SUM(status = 'failed') AS failed, SUM(status IN ('queued','sending')) AS pending, SUM(status = 'held') AS held, SUM(opened_at IS NOT NULL) AS opens, SUM(clicked_at IS NOT NULL) AS clicks, SUM(order_id > 0) AS orders, SUM(revenue) AS revenue";
		// phpcs:disable WordPress.DB
		$rows     = $wpdb->get_results( "SELECT campaign_id, {$agg} FROM {$table} {$where} GROUP BY campaign_id", ARRAY_A );
		$variants = $wpdb->get_results( "SELECT campaign_id, variant, {$agg} FROM {$table} {$where} " . ( $where ? 'AND' : 'WHERE' ) . " status <> 'held' GROUP BY campaign_id, variant", ARRAY_A );
		// phpcs:enable
		$shape = static function ( $r ) {
			return array(
				'total'   => (int) $r['total'],
				'sent'    => (int) $r['sent'],
				'failed'  => (int) $r['failed'],
				'pending' => (int) $r['pending'],
				'held'    => (int) $r['held'],
				'opens'   => (int) $r['opens'],
				'clicks'  => (int) $r['clicks'],
				'orders'  => (int) $r['orders'],
				'revenue' => round( (float) $r['revenue'], 2 ),
			);
		};
		$out = array();
		foreach ( (array) $rows as $r ) {
			$out[ (int) $r['campaign_id'] ] = $shape( $r );
		}
		foreach ( (array) $variants as $r ) {
			$out[ (int) $r['campaign_id'] ]['variants'][ $r['variant'] ] = $shape( $r );
		}
		return $out;
	}

	/**
	 * @param array      $row   Campaign row (content decoded).
	 * @param array|null $stats Recipient aggregates.
	 * @return array
	 */
	private static function to_public( array $row, $stats ) {
		$iso = static function ( $d ) {
			return $d ? gmdate( 'c', strtotime( $d . ' UTC' ) ) : null;
		};
		return array(
			'id'          => (int) $row['id'],
			'name'        => $row['name'],
			'subject'     => $row['subject'],
			'preheader'   => $row['preheader'],
			'emoji'       => $row['emoji'],
			'segment'     => $row['segment'],
			'status'      => $row['status'],
			'content'     => is_array( $row['content'] ) ? $row['content'] : self::default_content(),
			'scheduledAt' => $iso( $row['scheduled_at'] ),
			'startedAt'   => $iso( $row['started_at'] ),
			'finishedAt'  => $iso( $row['finished_at'] ),
			'updatedAt'   => $iso( $row['updated_at'] ),
			'ab'          => $row['ab'] ?? null,
			'abPhase'     => $row['ab_phase'] ?? '',
			'abWinner'    => $row['ab_winner'] ?? '',
			'abDecideAt'  => $iso( $row['ab_decide_at'] ?? null ),
			'stats'       => $stats ? $stats : array( 'total' => 0, 'sent' => 0, 'failed' => 0, 'pending' => 0, 'held' => 0, 'opens' => 0, 'clicks' => 0, 'orders' => 0, 'revenue' => 0 ),
		);
	}

	/** @return array Starter content for a new campaign. */
	public static function default_content() {
		$site = wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES );
		return array(
			'accent' => '#4F46E5',
			'blocks' => array(
				array( 'id' => 'b1', 'type' => 'header', 'eyebrow' => strtoupper( $site ), 'title' => __( 'Something new is here', 'noonfy' ) ),
				array( 'id' => 'b2', 'type' => 'text', 'html' => __( 'Tell your customers what’s new. Click any text in the email to edit it.', 'noonfy' ) ),
				array( 'id' => 'b3', 'type' => 'button', 'label' => __( 'Shop now', 'noonfy' ), 'url' => home_url( '/' ) ),
				array( 'id' => 'b4', 'type' => 'footer' ),
			),
		);
	}

	/**
	 * @param array $input Fields.
	 * @return array|WP_Error New campaign (browser shape).
	 */
	public static function create( array $input ) {
		global $wpdb;
		$data = self::sanitize( $input, null );
		if ( is_wp_error( $data ) ) {
			return $data;
		}
		$now                = gmdate( 'Y-m-d H:i:s' );
		$data['status']     = 'draft';
		$data['created_at'] = $now;
		$data['updated_at'] = $now;
		$wpdb->insert( self::table(), $data ); // phpcs:ignore WordPress.DB
		return self::get_public( (int) $wpdb->insert_id );
	}

	/**
	 * Edits a campaign that hasn't started sending.
	 *
	 * @param int   $id    Campaign id.
	 * @param array $input Changed fields.
	 * @return array|WP_Error Updated campaign.
	 */
	public static function update( $id, array $input ) {
		global $wpdb;
		$row = self::get( $id );
		if ( ! $row ) {
			return new WP_Error( 'noonfy_not_found', __( 'Campaign not found.', 'noonfy' ), array( 'status' => 404 ) );
		}
		if ( ! in_array( $row['status'], array( 'draft', 'scheduled' ), true ) ) {
			return new WP_Error( 'noonfy_locked', __( 'This campaign has already been sent and can no longer be edited. Duplicate it instead.', 'noonfy' ), array( 'status' => 409 ) );
		}
		$data = self::sanitize( $input, $row );
		if ( is_wp_error( $data ) ) {
			return $data;
		}
		$data['updated_at'] = gmdate( 'Y-m-d H:i:s' );
		$wpdb->update( self::table(), $data, array( 'id' => (int) $id ) ); // phpcs:ignore WordPress.DB
		return self::get_public( $id );
	}

	/**
	 * @param int    $id     Campaign id.
	 * @param string $status New status.
	 * @param array  $extra  Other columns to set.
	 */
	public static function set_status( $id, $status, array $extra = array() ) {
		global $wpdb;
		$wpdb->update( self::table(), array_merge( array( 'status' => $status, 'updated_at' => gmdate( 'Y-m-d H:i:s' ) ), $extra ), array( 'id' => (int) $id ) ); // phpcs:ignore WordPress.DB
	}

	/**
	 * @param int $id Campaign id.
	 * @return array|WP_Error Copy as a new draft.
	 */
	public static function duplicate( $id ) {
		$row = self::get( $id );
		if ( ! $row ) {
			return new WP_Error( 'noonfy_not_found', __( 'Campaign not found.', 'noonfy' ), array( 'status' => 404 ) );
		}
		/* translators: %s: campaign name */
		$row['name'] = sprintf( __( '%s (copy)', 'noonfy' ), $row['name'] );
		return self::create( $row );
	}

	/**
	 * Deletes a campaign and its recipient rows (not while it is sending).
	 *
	 * @param int $id Campaign id.
	 * @return true|WP_Error
	 */
	public static function delete( $id ) {
		global $wpdb;
		$row = self::get( $id );
		if ( ! $row ) {
			return new WP_Error( 'noonfy_not_found', __( 'Campaign not found.', 'noonfy' ), array( 'status' => 404 ) );
		}
		if ( 'sending' === $row['status'] ) {
			return new WP_Error( 'noonfy_locked', __( 'Pause or cancel the campaign before deleting it.', 'noonfy' ), array( 'status' => 409 ) );
		}
		$wpdb->delete( self::recipients_table(), array( 'campaign_id' => (int) $id ) ); // phpcs:ignore WordPress.DB
		$wpdb->delete( self::table(), array( 'id' => (int) $id ) ); // phpcs:ignore WordPress.DB
		return true;
	}

	/**
	 * @param array      $in       Submitted fields.
	 * @param array|null $existing Saved campaign when updating.
	 * @return array|WP_Error DB columns.
	 */
	private static function sanitize( array $in, $existing ) {
		$base = $existing ? $existing : array(
			'name'      => __( 'Untitled campaign', 'noonfy' ),
			'subject'   => '',
			'preheader' => '',
			'emoji'     => '✉️',
			'segment'   => 'all',
			'content'   => self::default_content(),
			'ab'        => null,
		);
		$get  = static function ( $k ) use ( $in, $base ) {
			return array_key_exists( $k, $in ) ? $in[ $k ] : $base[ $k ];
		};

		$name    = sanitize_text_field( (string) $get( 'name' ) );
		$segment = (string) $get( 'segment' );
		$emoji   = (string) $get( 'emoji' );
		$content = self::sanitize_content( $get( 'content' ) );

		return array(
			'name'      => mb_substr( '' !== $name ? $name : __( 'Untitled campaign', 'noonfy' ), 0, 190 ),
			'subject'   => mb_substr( sanitize_text_field( (string) $get( 'subject' ) ), 0, 255 ),
			'preheader' => mb_substr( sanitize_text_field( (string) $get( 'preheader' ) ), 0, 255 ),
			'emoji'     => in_array( $emoji, self::EMOJIS, true ) ? $emoji : '✉️',
			'segment'   => array_key_exists( $segment, Noonfy_Contacts::SEGMENTS ) ? $segment : 'all',
			'content'   => wp_json_encode( $content ),
			'ab'        => wp_json_encode( self::sanitize_ab( $get( 'ab' ), $content ) ),
		);
	}

	/**
	 * A/B test config. Disabled configs are kept (so toggling off and on keeps variant B).
	 *
	 * @param mixed $ab      Submitted config.
	 * @param array $content Variant A content (used as variant B's starting point).
	 * @return array
	 */
	private static function sanitize_ab( $ab, array $content ) {
		$ab = is_array( $ab ) ? $ab : array();
		$text = static function ( $k, $default = '' ) use ( $ab ) {
			return mb_substr( sanitize_text_field( (string) ( $ab[ $k ] ?? $default ) ), 0, 255 );
		};
		$wait = (int) ( $ab['waitHours'] ?? 4 );
		return array(
			'enabled'    => rest_sanitize_boolean( $ab['enabled'] ?? false ),
			'type'       => in_array( $ab['type'] ?? '', array( 'subject', 'content' ), true ) ? $ab['type'] : 'subject',
			'subjectB'   => $text( 'subjectB' ),
			'preheaderB' => $text( 'preheaderB' ),
			'contentB'   => isset( $ab['contentB'] ) ? self::sanitize_content( $ab['contentB'] ) : $content,
			'labelA'     => $text( 'labelA', 'Version A' ),
			'labelB'     => $text( 'labelB', 'Version B' ),
			'metric'     => in_array( $ab['metric'] ?? '', array( 'opens', 'clicks', 'revenue' ), true ) ? $ab['metric'] : 'opens',
			'testPct'    => max( 10, min( 50, (int) ( $ab['testPct'] ?? 20 ) ) ),
			'waitHours'  => in_array( $wait, self::AB_WAITS, true ) ? $wait : 4,
		);
	}

	/**
	 * Validates builder content. Unknown block types and fields are dropped.
	 *
	 * @param mixed $content { accent, blocks[] }.
	 * @return array
	 */
	public static function sanitize_content( $content ) {
		$content = is_array( $content ) ? $content : array();
		$accent  = sanitize_hex_color( (string) ( $content['accent'] ?? '' ) );
		$blocks  = array();
		foreach ( array_slice( (array) ( $content['blocks'] ?? array() ), 0, 60 ) as $b ) {
			if ( ! is_array( $b ) || ! in_array( $b['type'] ?? '', self::BLOCK_TYPES, true ) ) {
				continue;
			}
			$blocks[] = self::sanitize_block( $b );
		}
		return array(
			'accent' => $accent ? $accent : '#4F46E5',
			'blocks' => $blocks,
		);
	}

	/**
	 * @param array $b Block.
	 * @return array
	 */
	private static function sanitize_block( array $b ) {
		$text = static function ( $k, $max = 300 ) use ( $b ) {
			return mb_substr( sanitize_text_field( (string) ( $b[ $k ] ?? '' ) ), 0, $max );
		};
		$url  = static function ( $k ) use ( $b ) {
			return esc_url_raw( (string) ( $b[ $k ] ?? '' ), array( 'http', 'https', 'mailto' ) );
		};
		$out  = array(
			'id'   => preg_replace( '/[^a-z0-9_-]/i', '', (string) ( $b['id'] ?? '' ) ) ?: 'b' . wp_rand( 1000, 999999 ),
			'type' => $b['type'],
		);

		switch ( $b['type'] ) {
			case 'header':
				$out += array( 'eyebrow' => $text( 'eyebrow', 80 ), 'title' => $text( 'title', 160 ) );
				break;
			case 'image':
				$out += array( 'src' => $url( 'src' ), 'alt' => $text( 'alt', 160 ), 'link' => $url( 'link' ) );
				break;
			case 'text':
				$out['html'] = wp_kses( mb_substr( (string) ( $b['html'] ?? '' ), 0, 20000 ), self::TEXT_TAGS, array( 'http', 'https', 'mailto' ) );
				break;
			case 'products':
				$ids                = array_values( array_unique( array_filter( array_map( 'absint', (array) ( $b['productIds'] ?? array() ) ) ) ) );
				$out['productIds'] = array_slice( $ids, 0, 4 );
				// Automation emails can show products from the trigger instead (see Noonfy_Automation_Runner::dynamic).
				$out['source'] = in_array( $b['source'] ?? '', self::PRODUCT_SOURCES, true ) ? $b['source'] : 'manual';
				break;
			case 'button':
				$out += array(
					'label' => $text( 'label', 60 ),
					'url'   => $url( 'url' ),
					'dest'  => 'cart' === ( $b['dest'] ?? '' ) ? 'cart' : 'url', // cart: the saved-cart restore link.
				);
				break;
			case 'countdown':
				$ts           = strtotime( (string) ( $b['until'] ?? '' ) );
				$out['until'] = $ts ? gmdate( 'c', $ts ) : gmdate( 'c', time() + 3 * DAY_IN_SECONDS );
				break;
			case 'reviews':
				$out += array( 'quote' => $text( 'quote', 400 ), 'author' => $text( 'author', 80 ), 'stars' => max( 1, min( 5, (int) ( $b['stars'] ?? 5 ) ) ) );
				break;
			case 'coupon':
				$out += array( 'code' => strtoupper( $text( 'code', 40 ) ), 'note' => $text( 'note', 120 ) );
				break;
		}
		return $out;
	}

	/**
	 * Recipient rows of one campaign (for the report).
	 *
	 * @param int $id Campaign id.
	 * @return int Count of recipients still to send.
	 */
	public static function pending_count( $id ) {
		global $wpdb;
		$table = self::recipients_table();
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE campaign_id = %d AND status IN ('queued','sending')", (int) $id ) ); // phpcs:ignore WordPress.DB
	}

	/**
	 * @param int $id Campaign id.
	 * @return int Recipients waiting for the A/B winner.
	 */
	public static function held_count( $id ) {
		global $wpdb;
		$table = self::recipients_table();
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE campaign_id = %d AND status = 'held'", (int) $id ) ); // phpcs:ignore WordPress.DB
	}
}
