<?php
/**
 * Cart capture, cart restore links and product-view tracking (for cart and browse abandonment).
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Carts are saved only while a live workflow uses them, and only when the shopper's email is known:
 * signed-in customers, and guests once they type their email at checkout (a notice under the field says
 * the cart is saved). Product views are recorded only for signed-in shoppers.
 *
 * A cart becomes "abandoned" by time alone: Noonfy_Automation_Triggers::scan() enrolls carts that
 * haven't changed for the workflow's delay. Placing an order marks the cart ordered.
 */
class Noonfy_Carts {

	/** @var bool Save the cart when the request ends. */
	private static $dirty = false;

	/** @return string */
	public static function table() {
		global $wpdb;
		return $wpdb->prefix . 'noonfy_carts';
	}

	/** @return string */
	public static function views_table() {
		global $wpdb;
		return $wpdb->prefix . 'noonfy_product_views';
	}

	/** Creates or upgrades the tables (called by Noonfy_Install). */
	public static function create_tables() {
		global $wpdb;
		$charset = $wpdb->get_charset_collate();
		$carts   = self::table();
		$views   = self::views_table();
		dbDelta(
			"CREATE TABLE {$carts} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				session_key varchar(64) NOT NULL,
				user_id bigint(20) unsigned NOT NULL DEFAULT 0,
				contact_id bigint(20) unsigned NOT NULL DEFAULT 0,
				email varchar(190) NOT NULL DEFAULT '',
				items longtext NOT NULL,
				total decimal(14,2) NOT NULL DEFAULT 0,
				hash char(32) NOT NULL DEFAULT '',
				token char(32) NOT NULL,
				status varchar(10) NOT NULL DEFAULT 'active',
				order_id bigint(20) unsigned NOT NULL DEFAULT 0,
				created_at datetime NOT NULL,
				updated_at datetime NOT NULL,
				PRIMARY KEY  (id),
				UNIQUE KEY session_key (session_key),
				UNIQUE KEY token (token),
				KEY status_updated (status, updated_at),
				KEY email (email)
			) {$charset};"
		);
		dbDelta(
			"CREATE TABLE {$views} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				user_id bigint(20) unsigned NOT NULL,
				product_id bigint(20) unsigned NOT NULL,
				viewed_at datetime NOT NULL,
				PRIMARY KEY  (id),
				UNIQUE KEY user_product (user_id, product_id),
				KEY viewed_at (viewed_at)
			) {$charset};"
		);
	}

	/** Hooks the storefront. */
	public static function init() {
		add_action( 'template_redirect', array( __CLASS__, 'maybe_restore' ), 5 );
		add_action( 'template_redirect', array( __CLASS__, 'track_view' ) );

		if ( ! self::capturing() ) {
			return;
		}
		add_action( 'woocommerce_cart_updated', array( __CLASS__, 'mark_dirty' ) );
		add_action( 'woocommerce_store_api_cart_update_customer_from_request', array( __CLASS__, 'mark_dirty' ) );
		add_action( 'woocommerce_checkout_update_order_review', array( __CLASS__, 'classic_review_update' ) );
		add_action( 'shutdown', array( __CLASS__, 'maybe_save' ) );
		add_filter( 'woocommerce_checkout_fields', array( __CLASS__, 'classic_email_notice' ) );
		add_filter( 'render_block_woocommerce/checkout', array( __CLASS__, 'blocks_notice' ) );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'classic_script' ) );
	}

	/** @return bool Cart capture is on and a live workflow uses abandoned carts. */
	private static function capturing() {
		return Noonfy_Automation_Settings::get()['cartCapture'] && in_array( 'cart_abandoned', Noonfy_Workflows::live_triggers(), true );
	}

	/** Cart contents or customer details changed this request. */
	public static function mark_dirty() {
		self::$dirty = true;
	}

	/**
	 * Classic checkout posts the whole form when it refreshes totals; keep the email the guest typed.
	 *
	 * @param string $post_data Serialized checkout form.
	 */
	public static function classic_review_update( $post_data ) {
		parse_str( (string) $post_data, $fields );
		$email = isset( $fields['billing_email'] ) ? sanitize_email( (string) $fields['billing_email'] ) : '';
		if ( $email && is_email( $email ) && function_exists( 'WC' ) && WC()->session ) {
			WC()->session->set( 'noonfy_email', $email );
			self::$dirty = true;
		}
	}

	/** Classic checkout: refresh totals when the email changes, so the email reaches the hook above. */
	public static function classic_script() {
		if ( is_user_logged_in() || ! function_exists( 'is_checkout' ) || ! is_checkout() || has_block( 'woocommerce/checkout' ) ) {
			return;
		}
		wp_add_inline_script( 'wc-checkout', "jQuery(function($){ $(document.body).on('change', '#billing_email', function(){ $(document.body).trigger('update_checkout'); }); });" );
	}

	/**
	 * Classic checkout: the saved-cart notice under the email field (guests only).
	 *
	 * @param array $fields Checkout fields.
	 * @return array
	 */
	public static function classic_email_notice( $fields ) {
		if ( ! is_user_logged_in() && isset( $fields['billing']['billing_email'] ) ) {
			$fields['billing']['billing_email']['description'] = Noonfy_Automation_Settings::get()['cartNotice'];
		}
		return $fields;
	}

	/**
	 * Block checkout: the saved-cart notice above the form (guests only).
	 *
	 * @param string $html Rendered block.
	 * @return string
	 */
	public static function blocks_notice( $html ) {
		if ( is_user_logged_in() ) {
			return $html;
		}
		return '<p class="noonfy-cart-notice" style="font-size:0.85em;opacity:.8;margin:0 0 1em">' . esc_html( Noonfy_Automation_Settings::get()['cartNotice'] ) . '</p>' . $html;
	}

	/** Saves the cart at the end of a request that changed it. */
	public static function maybe_save() {
		if ( self::$dirty ) {
			self::$dirty = false;
			self::save();
		}
	}

	/**
	 * Stores the current shopper's cart (when their email is known).
	 */
	public static function save() {
		global $wpdb;
		if ( ! function_exists( 'WC' ) || ! WC()->cart || ! WC()->session ) {
			return;
		}
		$key   = substr( (string) WC()->session->get_customer_id(), 0, 64 );
		$table = self::table();
		if ( '' === $key ) {
			return;
		}
		$items = array();
		foreach ( WC()->cart->get_cart() as $item ) {
			$items[] = array(
				'product_id'   => (int) $item['product_id'],
				'variation_id' => (int) ( $item['variation_id'] ?? 0 ),
				'quantity'     => (int) $item['quantity'],
				'variation'    => array_map( 'sanitize_text_field', (array) ( $item['variation'] ?? array() ) ),
			);
		}
		$existing = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE session_key = %s", $key ), ARRAY_A ); // phpcs:ignore WordPress.DB
		if ( ! $items ) {
			if ( $existing && 'active' === $existing['status'] ) {
				$wpdb->delete( $table, array( 'id' => $existing['id'] ) ); // phpcs:ignore WordPress.DB
			}
			return;
		}

		$user  = wp_get_current_user();
		$email = $user->ID ? $user->user_email : (string) WC()->session->get( 'noonfy_email' );
		if ( ! $email && WC()->customer ) {
			$email = (string) WC()->customer->get_billing_email();
		}
		$email = strtolower( sanitize_email( $email ) );
		if ( ! is_email( $email ) ) {
			return;
		}
		$hash = md5( wp_json_encode( $items ) . $email );
		$now  = gmdate( 'Y-m-d H:i:s' );
		// Unchanged and touched recently: nothing to do (cart events fire on most page loads).
		if ( $existing && $existing['hash'] === $hash && 'active' === $existing['status'] && strtotime( $existing['updated_at'] . ' UTC' ) > time() - 5 * MINUTE_IN_SECONDS ) {
			return;
		}

		$customer   = WC()->customer;
		$contact_id = Noonfy_Contacts::upsert(
			$email,
			array(
				'first_name' => $user->ID ? $user->first_name : ( $customer ? $customer->get_billing_first_name() : '' ),
				'last_name'  => $user->ID ? $user->last_name : ( $customer ? $customer->get_billing_last_name() : '' ),
				'user_id'    => $user->ID,
				'source'     => 'cart',
			)
		);
		$row = array(
			'user_id'    => (int) $user->ID,
			'contact_id' => (int) $contact_id,
			'email'      => $email,
			'items'      => wp_json_encode( $items ),
			'total'      => round( (float) WC()->cart->get_cart_contents_total() + (float) WC()->cart->get_cart_contents_tax(), 2 ),
			'hash'       => $hash,
			'status'     => 'active',
			'updated_at' => $now,
		);
		if ( $existing ) {
			if ( 'active' !== $existing['status'] ) {
				$row += array( 'order_id' => 0, 'created_at' => $now ); // A new cart after an order.
			}
			$wpdb->update( $table, $row, array( 'id' => $existing['id'] ) ); // phpcs:ignore WordPress.DB
		} else {
			$wpdb->insert( $table, $row + array( 'session_key' => $key, 'token' => bin2hex( random_bytes( 16 ) ), 'created_at' => $now ) ); // phpcs:ignore WordPress.DB
		}
	}

	/**
	 * Marks the shopper's cart as ordered (by session, and by the order's email).
	 *
	 * @param WC_Order $order Order.
	 */
	public static function order_placed( $order ) {
		global $wpdb;
		$table = self::table();
		$key   = function_exists( 'WC' ) && WC()->session ? (string) WC()->session->get_customer_id() : '';
		$email = strtolower( (string) $order->get_billing_email() );
		// phpcs:ignore WordPress.DB
		$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET status = 'ordered', order_id = %d, updated_at = %s WHERE status = 'active' AND (session_key = %s OR (email <> '' AND email = %s))", $order->get_id(), gmdate( 'Y-m-d H:i:s' ), $key, $email ) );
	}

	/**
	 * @param int $id Cart id.
	 * @return array|null
	 */
	public static function get( $id ) {
		global $wpdb;
		$table = self::table();
		return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", (int) $id ), ARRAY_A ); // phpcs:ignore WordPress.DB
	}

	/**
	 * @param array $cart Cart row.
	 * @return int[] Product ids in it.
	 */
	public static function product_ids( array $cart ) {
		$items = json_decode( (string) $cart['items'], true );
		return array_values( array_unique( array_map( 'intval', wp_list_pluck( is_array( $items ) ? $items : array(), 'product_id' ) ) ) );
	}

	/**
	 * @param string $token Cart token.
	 * @return string Link that refills the cart and opens it.
	 */
	public static function restore_url( $token ) {
		return add_query_arg( 'noonfy_cart', $token, home_url( '/' ) );
	}

	/** `?noonfy_cart=TOKEN`: puts the saved items back in the cart and opens the cart page. */
	public static function maybe_restore() {
		if ( empty( $_GET['noonfy_cart'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			return;
		}
		global $wpdb;
		$token = sanitize_key( wp_unslash( $_GET['noonfy_cart'] ) ); // phpcs:ignore WordPress.Security.NonceVerification
		$table = self::table();
		$cart  = preg_match( '/^[a-f0-9]{32}$/', $token ) ? $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE token = %s", $token ), ARRAY_A ) : null; // phpcs:ignore WordPress.DB
		if ( $cart && function_exists( 'WC' ) && WC()->cart ) {
			if ( WC()->session && ! WC()->session->has_session() ) {
				WC()->session->set_customer_session_cookie( true );
			}
			if ( WC()->cart->is_empty() ) {
				foreach ( (array) json_decode( (string) $cart['items'], true ) as $item ) {
					WC()->cart->add_to_cart( (int) $item['product_id'], max( 1, (int) $item['quantity'] ), (int) $item['variation_id'], (array) $item['variation'] );
				}
			}
			if ( WC()->session && ! is_user_logged_in() ) {
				WC()->session->set( 'noonfy_email', $cart['email'] );
			}
			self::$dirty = true;
		}
		wp_safe_redirect( function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : home_url( '/' ) );
		exit;
	}

	/** Remembers product pages viewed by signed-in shoppers, while a browse-abandonment workflow is live. */
	public static function track_view() {
		global $wpdb;
		if ( ! is_user_logged_in() || ! function_exists( 'is_product' ) || ! is_product() || current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		if ( ! Noonfy_Automation_Settings::get()['browseTracking'] || ! in_array( 'browse_abandoned', Noonfy_Workflows::live_triggers(), true ) ) {
			return;
		}
		$table = self::views_table();
		// phpcs:ignore WordPress.DB
		$wpdb->query( $wpdb->prepare( "INSERT INTO {$table} (user_id, product_id, viewed_at) VALUES (%d, %d, %s) ON DUPLICATE KEY UPDATE viewed_at = VALUES(viewed_at)", get_current_user_id(), get_queried_object_id(), gmdate( 'Y-m-d H:i:s' ) ) );
	}

	/** Daily: forget old carts and views. */
	public static function purge() {
		global $wpdb;
		$carts = self::table();
		$views = self::views_table();
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$carts} WHERE updated_at < %s", gmdate( 'Y-m-d H:i:s', time() - 60 * DAY_IN_SECONDS ) ) ); // phpcs:ignore WordPress.DB
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$views} WHERE viewed_at < %s", gmdate( 'Y-m-d H:i:s', time() - 30 * DAY_IN_SECONDS ) ) ); // phpcs:ignore WordPress.DB
	}
}
