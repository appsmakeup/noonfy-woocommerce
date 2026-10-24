<?php
/**
 * Routes wp_mail() through Noonfy's SMTP connections, with failover and logging.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * How a message travels:
 *
 * 1. `pre_wp_mail` (late priority) picks an ordered list of candidate connections. With none enabled it
 *    does nothing and WordPress sends as usual (still logged).
 * 2. For each candidate (up to MAX_ATTEMPTS) it calls wp_mail() again; that nested call skips step 1,
 *    and `phpmailer_init` points PHPMailer at the current candidate.
 * 3. `wp_mail_succeeded` / `wp_mail_failed` log every attempt. The first success stops the loop, and the
 *    original wp_mail() caller (e.g. WooCommerce) gets the final result.
 */
class Noonfy_Mailer {

	const MAX_ATTEMPTS = 3;

	/** @var bool Inside our own nested wp_mail() call. */
	private static $routing = false;

	/** @var array|null Connection used for the current attempt. */
	private static $current = null;

	/** @var array|null Connection forced for the next message (connection test emails). */
	private static $forced = null;

	/** @var float Attempt start time. */
	private static $start = 0.0;

	/** @var int Attempt number for the current message. */
	private static $attempt = 1;

	/** @var bool Whether another candidate will be tried if this attempt fails. */
	private static $has_next = false;

	/** Hooks into wp_mail(). */
	public static function init() {
		add_filter( 'pre_wp_mail', array( __CLASS__, 'pre_wp_mail' ), 1000, 2 );
		add_action( 'phpmailer_init', array( __CLASS__, 'configure' ), 1000 );
		add_action( 'wp_mail_succeeded', array( __CLASS__, 'on_success' ) );
		add_action( 'wp_mail_failed', array( __CLASS__, 'on_failure' ) );
		add_filter( 'wp_mail_from', array( __CLASS__, 'from_email' ), 1000 );
		add_filter( 'wp_mail_from_name', array( __CLASS__, 'from_name' ), 1000 );
	}

	/**
	 * Sends the next message through one specific connection (used by "send test email").
	 *
	 * @param array|null $connection Raw connection, or null to clear.
	 */
	public static function force_connection( $connection ) {
		self::$forced = $connection;
	}

	/** @return bool Whether any connection is enabled, i.e. Noonfy is handling mail. */
	public static function is_routing_active() {
		return (bool) Noonfy_Connections::enabled();
	}

	/**
	 * @param null|bool $short_circuit Another plugin's result, if it already handled the message.
	 * @param array     $atts          to, subject, message, headers, attachments.
	 * @return null|bool
	 */
	public static function pre_wp_mail( $short_circuit, $atts ) {
		if ( null !== $short_circuit || self::$routing ) {
			return $short_circuit;
		}

		self::$start    = microtime( true );
		self::$current  = null;
		self::$attempt  = 1;
		self::$has_next = false;

		$candidates   = self::$forced ? array( self::$forced ) : Noonfy_Router::candidates();
		self::$forced = null;
		if ( ! $candidates ) {
			return null;
		}

		$candidates    = array_slice( $candidates, 0, self::MAX_ATTEMPTS );
		$sent          = false;
		self::$routing = true;
		try {
			foreach ( $candidates as $i => $connection ) {
				self::$current  = $connection;
				self::$attempt  = $i + 1;
				self::$has_next = $i + 1 < count( $candidates );
				self::$start    = microtime( true );
				$sent           = wp_mail( $atts['to'], $atts['subject'], $atts['message'], $atts['headers'], $atts['attachments'] );
				if ( $sent ) {
					break;
				}
			}
		} finally {
			self::$routing  = false;
			self::$current  = null;
			self::$has_next = false;
		}
		return (bool) $sent;
	}

	/**
	 * Points PHPMailer at the current connection.
	 *
	 * @param PHPMailer\PHPMailer\PHPMailer $phpmailer Mailer instance (by reference semantics).
	 */
	public static function configure( $phpmailer ) {
		if ( ! self::$current ) {
			return;
		}
		$c = Noonfy_Connections::smtp_config( self::$current );

		$phpmailer->isSMTP();
		$phpmailer->Host        = $c['host'];
		$phpmailer->Port        = $c['port'];
		$phpmailer->SMTPSecure  = 'none' === $c['encryption'] ? '' : $c['encryption'];
		$phpmailer->SMTPAutoTLS = 'none' !== $c['encryption'];
		$phpmailer->SMTPAuth    = '' !== $c['username'];
		$phpmailer->Username    = $c['username'];
		$phpmailer->Password    = $c['password'];
		$phpmailer->Timeout     = 15;
		// PHPMailer waits up to 300s for each server reply by default; never stall a checkout that long.
		$phpmailer->getSMTPInstance()->Timelimit = 20;

		// A connection's own sender (usually an address verified with that provider) always wins.
		if ( '' !== self::$current['fromEmail'] ) {
			$name = '' !== self::$current['fromName'] ? self::$current['fromName'] : $phpmailer->FromName;
			$phpmailer->setFrom( self::$current['fromEmail'], $name, false );
		}
		$phpmailer->Sender = $phpmailer->From;
	}

	/**
	 * Applies the default sender when Noonfy handles mail and the message still has WordPress's default
	 * sender (or "override other plugins" is on).
	 *
	 * @param string $from Current from address.
	 * @return string
	 */
	public static function from_email( $from ) {
		$settings = Noonfy_SMTP_Settings::get();
		if ( '' === $settings['fromEmail'] || ! self::is_routing_active() ) {
			return $from;
		}
		return ( $settings['forceFrom'] || self::is_wordpress_default( $from ) ) ? $settings['fromEmail'] : $from;
	}

	/**
	 * @param string $name Current from name.
	 * @return string
	 */
	public static function from_name( $name ) {
		$settings = Noonfy_SMTP_Settings::get();
		if ( '' === $settings['fromName'] || ! self::is_routing_active() ) {
			return $name;
		}
		return ( $settings['forceFrom'] || 'WordPress' === $name ) ? $settings['fromName'] : $name;
	}

	/**
	 * @param string $from Address.
	 * @return bool Whether it is WordPress's built-in wordpress@site default.
	 */
	private static function is_wordpress_default( $from ) {
		$host = (string) wp_parse_url( network_home_url(), PHP_URL_HOST );
		if ( 0 === strpos( $host, 'www.' ) ) {
			$host = substr( $host, 4 );
		}
		return strtolower( $from ) === 'wordpress@' . strtolower( $host );
	}

	/** @param array $mail_data to, subject, message, headers, attachments. */
	public static function on_success( $mail_data ) {
		self::log( 'SENT', $mail_data, null );
	}

	/** @param WP_Error $error Failure from wp_mail(). */
	public static function on_failure( $error ) {
		$data = (array) $error->get_error_data();
		self::log( self::$has_next ? 'RETRY' : 'FAILED', $data, $error->get_error_message() );
	}

	/**
	 * @param string      $status SENT, RETRY or FAILED.
	 * @param array       $data   wp_mail data (to, subject...).
	 * @param string|null $error  Error message.
	 */
	private static function log( $status, array $data, $error ) {
		$to = $data['to'] ?? array();
		$to = is_array( $to ) ? implode( ', ', $to ) : (string) $to;
		$c  = self::$current;

		Noonfy_Email_Log::insert(
			array(
				'to'             => $to,
				'subject'        => (string) ( $data['subject'] ?? '' ),
				'connectionId'   => $c ? $c['id'] : '',
				'provider'       => $c ? $c['provider'] : 'phpmail',
				'connectionName' => $c ? $c['name'] : __( 'WordPress default (PHP mail)', 'noonfy' ),
				'status'         => $status,
				'attempt'        => self::$attempt,
				'latencyMs'      => self::$start ? (int) round( ( microtime( true ) - self::$start ) * 1000 ) : null,
				'error'          => $error,
			)
		);
	}

	/**
	 * Opens and authenticates an SMTP session without sending anything.
	 *
	 * @param array $config host, port, encryption, username, password.
	 * @return array{ok: bool, latencyMs: ?int, error: ?string}
	 */
	public static function test_smtp( array $config ) {
		require_once ABSPATH . WPINC . '/PHPMailer/PHPMailer.php';
		require_once ABSPATH . WPINC . '/PHPMailer/SMTP.php';
		require_once ABSPATH . WPINC . '/PHPMailer/Exception.php';

		$mail              = new PHPMailer\PHPMailer\PHPMailer( true );
		$mail->Host        = $config['host'];
		$mail->Port        = (int) $config['port'];
		$mail->SMTPSecure  = 'none' === $config['encryption'] ? '' : $config['encryption'];
		$mail->SMTPAutoTLS = 'none' !== $config['encryption'];
		$mail->SMTPAuth    = '' !== $config['username'];
		$mail->Username    = $config['username'];
		$mail->Password    = $config['password'];
		$mail->Timeout     = 10;
		$mail->isSMTP();
		$mail->getSMTPInstance()->Timelimit = 15;

		$start = microtime( true );
		try {
			$mail->smtpConnect();
			$latency = (int) round( ( microtime( true ) - $start ) * 1000 );
			$mail->smtpClose();
			return array(
				'ok'        => true,
				'latencyMs' => $latency,
				'error'     => null,
			);
		} catch ( Exception $e ) {
			$mail->smtpClose();
			return array(
				'ok'        => false,
				'latencyMs' => null,
				'error'     => $mail->ErrorInfo ? $mail->ErrorInfo : $e->getMessage(),
			);
		}
	}
}

/**
 * Orders enabled connections for a message according to the routing strategy.
 */
class Noonfy_Router {

	/**
	 * Candidates in the order they should be tried: the strategy's pick first, then the rest by priority.
	 * Connections that reached their daily limit are skipped.
	 *
	 * @return array[] Raw connections.
	 */
	public static function candidates() {
		$enabled = Noonfy_Connections::enabled();
		if ( ! $enabled ) {
			return array();
		}

		$sent_today = Noonfy_Email_Log::sent_today_by_connection();
		$available  = array_values(
			array_filter(
				$enabled,
				static function ( $c ) use ( $sent_today ) {
					return 0 === (int) $c['dailyLimit'] || ( $sent_today[ $c['id'] ] ?? 0 ) < (int) $c['dailyLimit'];
				}
			)
		);
		if ( ! $available ) {
			return array();
		}

		$first = self::pick( Noonfy_SMTP_Settings::get()['strategy'], $available, $sent_today );
		$rest  = array_values(
			array_filter(
				$available,
				static function ( $c ) use ( $first ) {
					return $c['id'] !== $first['id'];
				}
			)
		);
		return array_merge( array( $first ), $rest );
	}

	/**
	 * @param string  $strategy   Routing strategy.
	 * @param array[] $available  Connections by priority (non-empty).
	 * @param array   $sent_today Sends today per connection id.
	 * @return array The connection to try first.
	 */
	private static function pick( $strategy, array $available, array $sent_today ) {
		switch ( $strategy ) {
			case 'weighted':
				$total = array_sum( array_column( $available, 'weight' ) );
				if ( $total > 0 ) {
					$roll = wp_rand( 1, $total );
					foreach ( $available as $c ) {
						$roll -= (int) $c['weight'];
						if ( $roll <= 0 ) {
							return $c;
						}
					}
				}
				return $available[0];

			case 'roundrobin':
				$index = (int) get_option( 'noonfy_rr_index', 0 );
				update_option( 'noonfy_rr_index', $index + 1, false );
				return $available[ $index % count( $available ) ];

			case 'leastused':
				usort(
					$available,
					static function ( $a, $b ) use ( $sent_today ) {
						return self::usage_ratio( $a, $sent_today ) <=> self::usage_ratio( $b, $sent_today );
					}
				);
				return $available[0];

			case 'fastest':
			case 'health':
				$perf = Noonfy_Email_Log::performance_by_connection( 7 );
				$key  = 'fastest' === $strategy ? 'avgLatency' : 'successRate';
				$best = null;
				foreach ( $available as $c ) {
					$v = $perf[ $c['id'] ][ $key ] ?? null;
					if ( null === $v ) {
						continue;
					}
					if ( null === $best || ( 'fastest' === $strategy ? $v < $best[0] : $v > $best[0] ) ) {
						$best = array( $v, $c );
					}
				}
				return $best ? $best[1] : $available[0];

			default:
				// 'priority', plus 'cost' and 'deliverability' until cost and inbox-placement data exist.
				return $available[0];
		}
	}

	/**
	 * @param array $c          Connection.
	 * @param array $sent_today Sends today per connection id.
	 * @return float Share of the daily limit used (unlimited connections compare by raw count / 1e6).
	 */
	private static function usage_ratio( array $c, array $sent_today ) {
		$sent = $sent_today[ $c['id'] ] ?? 0;
		return (int) $c['dailyLimit'] > 0 ? $sent / (int) $c['dailyLimit'] : $sent / 1000000;
	}
}
