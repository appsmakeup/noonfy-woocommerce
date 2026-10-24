<?php
/**
 * Public endpoints: open pixel, click redirect, unsubscribe page. Revenue attribution.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * URLs are query-string endpoints on the site's home URL (they work with any permalink setting):
 * - ?noonfy_o=RID.SIG                 open pixel
 * - ?noonfy_c=RID.SIG&u=URL           click redirect (signature covers the URL: no open redirect)
 * - ?noonfy_unsub=TOKEN               unsubscribe / preferences page; POST = one-click (RFC 8058)
 *
 * RID is a campaign recipient id, or "a" + an automation send id (e.g. a42) for automation emails.
 */
class Noonfy_Tracking {

	const COOKIE          = 'noonfy_rid';
	const ATTRIBUTION_DAY = 7;

	/** Hooks the endpoints. */
	public static function init() {
		add_action( 'init', array( __CLASS__, 'route' ), 1 );
	}

	/**
	 * @param string $data Data to sign.
	 * @return string 16-char signature.
	 */
	private static function sign( $data ) {
		return substr( hash_hmac( 'sha256', $data, wp_salt( 'nonce' ) . 'noonfy-tracking' ), 0, 16 );
	}

	/**
	 * @param int    $rid   Recipient (or automation send) id.
	 * @param string $scope '' for campaigns, 'a' for automations.
	 * @return string
	 */
	public static function open_url( $rid, $scope = '' ) {
		$ref = $scope . $rid;
		return add_query_arg( 'noonfy_o', $ref . '.' . self::sign( 'o' . $ref ), home_url( '/' ) );
	}

	/**
	 * @param int    $rid   Recipient (or automation send) id.
	 * @param string $url   Destination.
	 * @param string $scope '' for campaigns, 'a' for automations.
	 * @return string
	 */
	public static function click_url( $rid, $url, $scope = '' ) {
		if ( 0 === strpos( $url, 'mailto:' ) || '' === $url ) {
			return $url;
		}
		$ref = $scope . $rid;
		return add_query_arg(
			array(
				'noonfy_c' => $ref . '.' . self::sign( 'c' . $ref . '|' . $url ),
				'u'        => rawurlencode( $url ),
			),
			home_url( '/' )
		);
	}

	/**
	 * @param string $token Contact token.
	 * @return string
	 */
	public static function unsubscribe_url( $token ) {
		return add_query_arg( 'noonfy_unsub', $token, home_url( '/' ) );
	}

	/** Dispatches public requests (front end only). */
	public static function route() {
		// phpcs:disable WordPress.Security.NonceVerification -- public, signed/tokened endpoints.
		if ( isset( $_GET['noonfy_o'] ) ) {
			self::handle_open( sanitize_text_field( wp_unslash( $_GET['noonfy_o'] ) ) );
		} elseif ( isset( $_GET['noonfy_c'], $_GET['u'] ) ) {
			self::handle_click( sanitize_text_field( wp_unslash( $_GET['noonfy_c'] ) ), (string) wp_unslash( $_GET['u'] ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- verified by signature, validated before redirect.
		} elseif ( isset( $_GET['noonfy_unsub'] ) ) {
			self::handle_unsubscribe( sanitize_text_field( wp_unslash( $_GET['noonfy_unsub'] ) ) );
		}
		// phpcs:enable
	}

	/**
	 * @param string $param RID.SIG.
	 * @param string $kind  'o', 'c' or 'k' (cookie).
	 * @param string $extra Signed extra data.
	 * @return string Verified reference ("12" or "a12"), or '' if the signature is wrong.
	 */
	private static function verify( $param, $kind, $extra = '' ) {
		$parts = explode( '.', $param );
		if ( 2 !== count( $parts ) || ! preg_match( '/^a?[0-9]+$/', $parts[0] ) ) {
			return '';
		}
		return hash_equals( self::sign( $kind . $parts[0] . $extra ), $parts[1] ) ? $parts[0] : '';
	}

	/**
	 * @param string $ref Verified reference.
	 * @return array{0: string, 1: int} Table holding the email, and its row id.
	 */
	private static function target( $ref ) {
		return 'a' === $ref[0] ? array( Noonfy_Workflows::sends_table(), (int) substr( $ref, 1 ) ) : array( Noonfy_Campaigns::recipients_table(), (int) $ref );
	}

	/** @param string $param RID.SIG. */
	private static function handle_open( $param ) {
		global $wpdb;
		$ref = self::verify( $param, 'o' );
		if ( '' !== $ref ) {
			list( $table, $rid ) = self::target( $ref );
			$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET opened_at = COALESCE(opened_at, %s), open_count = open_count + 1 WHERE id = %d", gmdate( 'Y-m-d H:i:s' ), $rid ) ); // phpcs:ignore WordPress.DB
		}
		nocache_headers();
		header( 'Content-Type: image/gif' );
		echo base64_decode( 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode, WordPress.Security.EscapeOutput.OutputNotEscaped
		exit;
	}

	/**
	 * @param string $param RID.SIG.
	 * @param string $url   Destination.
	 */
	private static function handle_click( $param, $url ) {
		global $wpdb;
		$ref = self::verify( $param, 'c', '|' . $url );
		// The signature proves the URL is the one in the email; only http(s) destinations are followed.
		if ( '' === $ref || ! in_array( wp_parse_url( $url, PHP_URL_SCHEME ), array( 'http', 'https' ), true ) ) {
			wp_safe_redirect( home_url( '/' ) );
			exit;
		}
		$now                 = gmdate( 'Y-m-d H:i:s' );
		list( $table, $rid ) = self::target( $ref );
		// A click implies an open (images may be blocked).
		$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET clicked_at = COALESCE(clicked_at, %s), click_count = click_count + 1, opened_at = COALESCE(opened_at, %s) WHERE id = %d", $now, $now, $rid ) ); // phpcs:ignore WordPress.DB
		setcookie( self::COOKIE, $ref . '.' . self::sign( 'k' . $ref ), time() + self::ATTRIBUTION_DAY * DAY_IN_SECONDS, COOKIEPATH ? COOKIEPATH : '/', COOKIE_DOMAIN, is_ssl(), true );
		wp_redirect( $url ); // phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect -- signed destination, may be off-site.
		exit;
	}

	/** @return string Email reference from the click cookie ("12" campaign, "a12" automation), or ''. */
	public static function cookie_recipient() {
		if ( empty( $_COOKIE[ self::COOKIE ] ) ) {
			return '';
		}
		return self::verify( sanitize_text_field( wp_unslash( $_COOKIE[ self::COOKIE ] ) ), 'k' );
	}

	/**
	 * Unsubscribe page. GET shows a confirmation (so link scanners can't unsubscribe people); POST acts.
	 * Mail clients' one-click unsubscribe POSTs "List-Unsubscribe=One-Click" with no action field.
	 *
	 * @param string $token Contact token.
	 */
	private static function handle_unsubscribe( $token ) {
		$contact = Noonfy_Contacts::by_token( $token );
		$site    = wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES );
		if ( ! $contact ) {
			self::page( $site, __( 'Link not recognised', 'noonfy' ), __( 'This unsubscribe link is invalid or has expired.', 'noonfy' ), '' );
		}

		if ( 'POST' === ( $_SERVER['REQUEST_METHOD'] ?? '' ) ) { // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
			$action = isset( $_POST['noonfy_action'] ) ? sanitize_key( $_POST['noonfy_action'] ) : 'unsubscribe'; // phpcs:ignore WordPress.Security.NonceVerification
			Noonfy_Contacts::set_marketing( (int) $contact['id'], 'resubscribe' === $action ? 'subscribed' : 'unsubscribed' );
			$contact = Noonfy_Contacts::by_token( $token );
			if ( 'resubscribe' !== $action && empty( $_POST['noonfy_action'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
				status_header( 200 );
				exit; // One-click request from a mail client: no page needed.
			}
		}

		$email = esc_html( $contact['email'] );
		if ( 'unsubscribed' === $contact['marketing'] ) {
			self::page(
				$site,
				__( 'You’re unsubscribed', 'noonfy' ),
				/* translators: %1$s: email, %2$s: site name */
				sprintf( __( '%1$s won’t receive marketing emails from %2$s any more. Order and account emails are not affected.', 'noonfy' ), $email, esc_html( $site ) ),
				self::form( 'resubscribe', __( 'Resubscribe', 'noonfy' ), false )
			);
		}
		self::page(
			$site,
			__( 'Unsubscribe?', 'noonfy' ),
			/* translators: %1$s: email, %2$s: site name */
			sprintf( __( 'Stop marketing emails from %2$s to %1$s?', 'noonfy' ), $email, esc_html( $site ) ),
			self::form( 'unsubscribe', __( 'Unsubscribe', 'noonfy' ), true )
		);
	}

	/**
	 * @param string $action  Form action value.
	 * @param string $label   Button label.
	 * @param bool   $primary Primary styling.
	 * @return string
	 */
	private static function form( $action, $label, $primary ) {
		$style = $primary ? 'background:linear-gradient(135deg,#4F46E5,#8B5CF6);color:#fff;border:none' : 'background:#fff;color:#3C3F55;border:1px solid #ECEDF4';
		return '<form method="post"><input type="hidden" name="noonfy_action" value="' . esc_attr( $action ) . '"><button type="submit" style="' . $style . ';border-radius:9px;padding:11px 22px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">' . esc_html( $label ) . '</button></form>';
	}

	/**
	 * Outputs a minimal standalone page and exits.
	 *
	 * @param string $site  Site name.
	 * @param string $title Heading.
	 * @param string $body  Message (already escaped).
	 * @param string $form  Form HTML.
	 */
	private static function page( $site, $title, $body, $form ) {
		nocache_headers();
		header( 'Content-Type: text/html; charset=utf-8' );
		header( 'X-Robots-Tag: noindex' );
		// phpcs:disable WordPress.Security.EscapeOutput.OutputNotEscaped -- parts escaped above.
		echo '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>' . esc_html( $title . ' · ' . $site ) . '</title></head>'
			. '<body style="margin:0;background:#F6F6FB;font-family:Manrope,Helvetica,Arial,sans-serif;color:#14152A">'
			. '<div style="max-width:440px;margin:12vh auto;background:#fff;border:1px solid #ECEDF4;border-radius:16px;padding:32px;text-align:center">'
			. '<div style="font-size:12px;font-weight:800;letter-spacing:2px;color:#8A8DA3">' . esc_html( strtoupper( $site ) ) . '</div>'
			. '<h1 style="font-size:22px;margin:12px 0 8px">' . esc_html( $title ) . '</h1>'
			. '<p style="font-size:14px;line-height:1.6;color:#5B5E75;margin:0 0 20px">' . $body . '</p>' . $form
			. '<p style="margin:22px 0 0"><a href="' . esc_url( home_url( '/' ) ) . '" style="color:#4F46E5;font-size:13px;font-weight:700;text-decoration:none">' . esc_html__( 'Back to the store', 'noonfy' ) . '</a></p>'
			. '</div></body></html>';
		// phpcs:enable
		exit;
	}

	/**
	 * Credits a paid order to the email that drove it — a campaign or an automation email: the click
	 * cookie captured at checkout, else the most recent email to the same address that was opened or
	 * clicked in the last 5 days.
	 *
	 * @param WC_Order $order Paid order.
	 */
	public static function attribute_order( $order ) {
		global $wpdb;
		if ( $order->get_meta( '_noonfy_attributed' ) ) {
			return;
		}
		$since = gmdate( 'Y-m-d H:i:s', time() - self::ATTRIBUTION_DAY * DAY_IN_SECONDS );
		$ref   = (string) $order->get_meta( '_noonfy_click_rid' );
		if ( preg_match( '/^a?[0-9]+$/', $ref ) ) {
			list( $table, $id ) = self::target( $ref );
			if ( ! $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE id = %d AND sent_at >= %s", $id, $since ) ) ) { // phpcs:ignore WordPress.DB
				$ref = '';
			}
		} else {
			$ref = '';
		}
		if ( '' === $ref && $order->get_billing_email() ) {
			$email   = strtolower( $order->get_billing_email() );
			$recent  = gmdate( 'Y-m-d H:i:s', time() - 5 * DAY_IN_SECONDS );
			$latest  = null;
			$sources = array( '' => Noonfy_Campaigns::recipients_table(), 'a' => Noonfy_Workflows::sends_table() );
			foreach ( $sources as $scope => $table ) {
				// phpcs:ignore WordPress.DB
				$row = $wpdb->get_row( $wpdb->prepare( "SELECT id, sent_at FROM {$table} WHERE email = %s AND sent_at >= %s AND (opened_at IS NOT NULL OR clicked_at IS NOT NULL) ORDER BY sent_at DESC LIMIT 1", $email, $recent ), ARRAY_A );
				if ( $row && ( ! $latest || $row['sent_at'] > $latest[1] ) ) {
					$latest = array( $scope . $row['id'], $row['sent_at'] );
				}
			}
			$ref = $latest ? $latest[0] : '';
		}
		$order->update_meta_data( '_noonfy_attributed', '' !== $ref ? $ref : 'none' );
		$order->save_meta_data();
		if ( '' === $ref ) {
			return;
		}
		list( $table, $id ) = self::target( $ref );
		if ( 'a' === $ref[0] ) {
			Noonfy_Automation_Runner::credit_send( $id, $order );
		} else {
			$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET order_id = %d, revenue = revenue + %f WHERE id = %d", $order->get_id(), (float) $order->get_total(), $id ) ); // phpcs:ignore WordPress.DB
		}
	}
}
