<?php
/**
 * WooCommerce hooks for campaigns: opt-in, contacts from orders, revenue attribution.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * - Checkout opt-in checkbox: classic checkout (template hook) and block checkout (Additional Checkout
 *   Fields API, WooCommerce 8.9+). Unticked by default; ticking it is the consent.
 * - "Email me news and offers" preference on My Account → Account details.
 * - Every order creates/updates the buyer's contact; paid orders add to their stats and are credited to
 *   the campaign that drove them (Noonfy_Tracking::attribute_order).
 */
class Noonfy_Woo_Integration {

	const BLOCKS_FIELD = 'noonfy/marketing-optin';

	/** Hooks into WooCommerce. */
	public static function init() {
		add_action( 'woocommerce_review_order_before_submit', array( __CLASS__, 'classic_checkbox' ) );
		add_action( 'woocommerce_checkout_order_processed', array( __CLASS__, 'classic_order_processed' ), 10, 3 );
		add_action( 'woocommerce_init', array( __CLASS__, 'register_blocks_field' ) );
		add_action( 'woocommerce_store_api_checkout_order_processed', array( __CLASS__, 'blocks_order_processed' ) );
		add_action( 'woocommerce_order_status_changed', array( __CLASS__, 'order_status_changed' ), 10, 4 );
		add_action( 'woocommerce_edit_account_form', array( __CLASS__, 'account_checkbox' ) );
		add_action( 'woocommerce_save_account_details', array( __CLASS__, 'save_account' ) );
	}

	/** @return bool Whether the checkout opt-in is shown. */
	private static function optin_enabled() {
		return (bool) Noonfy_Campaign_Settings::get()['checkoutOptin'];
	}

	/** Classic checkout checkbox, above "Place order". */
	public static function classic_checkbox() {
		if ( ! self::optin_enabled() ) {
			return;
		}
		echo '<p class="form-row noonfy-optin"><label class="woocommerce-form__label woocommerce-form__label-for-checkbox checkbox">'
			. '<input type="checkbox" class="woocommerce-form__input woocommerce-form__input-checkbox input-checkbox" name="noonfy_optin" value="1"> '
			. '<span>' . esc_html( Noonfy_Campaign_Settings::get()['optinLabel'] ) . '</span></label></p>';
	}

	/**
	 * @param int      $order_id Order id.
	 * @param array    $posted   Posted checkout data.
	 * @param WC_Order $order    Order.
	 */
	public static function classic_order_processed( $order_id, $posted, $order ) {
		// WooCommerce verified the checkout nonce before this hook runs.
		$optin = self::optin_enabled() && ! empty( $_POST['noonfy_optin'] ); // phpcs:ignore WordPress.Security.NonceVerification.Missing
		self::order_placed( $order, $optin );
	}

	/** Registers the block checkout field (WooCommerce 8.9+). */
	public static function register_blocks_field() {
		if ( ! self::optin_enabled() || ! function_exists( 'woocommerce_register_additional_checkout_field' ) ) {
			return;
		}
		woocommerce_register_additional_checkout_field(
			array(
				'id'       => self::BLOCKS_FIELD,
				'label'    => Noonfy_Campaign_Settings::get()['optinLabel'],
				'location' => 'order',
				'type'     => 'checkbox',
				'required' => false,
			)
		);
	}

	/** @param WC_Order $order Order placed through the block checkout. */
	public static function blocks_order_processed( $order ) {
		// Additional fields with location "order" are stored as `_wc_other/<field id>` order meta.
		$optin = self::optin_enabled() && wc_string_to_bool( (string) $order->get_meta( '_wc_other/' . self::BLOCKS_FIELD ) );
		self::order_placed( $order, $optin );
	}

	/**
	 * @param WC_Order $order Order.
	 * @param bool     $optin Ticked the opt-in.
	 */
	private static function order_placed( $order, $optin ) {
		Noonfy_Contacts::upsert_from_order( $order, array( 'optin' => $optin ) );
		// Capture the campaign click cookie now: payment confirmation often arrives later via a webhook without it.
		$rid = Noonfy_Tracking::cookie_recipient();
		if ( $rid ) {
			$order->update_meta_data( '_noonfy_click_rid', $rid );
		}
		if ( $optin ) {
			$order->update_meta_data( '_noonfy_marketing_optin', 'yes' );
		}
		$order->save_meta_data();
	}

	/**
	 * When an order becomes paid: add it to the contact's stats and attribute its revenue (once).
	 *
	 * @param int      $order_id Order id.
	 * @param string   $from     Old status.
	 * @param string   $to       New status.
	 * @param WC_Order $order    Order.
	 */
	public static function order_status_changed( $order_id, $from, $to, $order ) {
		if ( ! $order || ! in_array( $to, wc_get_is_paid_statuses(), true ) || $order->get_meta( '_noonfy_counted' ) ) {
			return;
		}
		$order->update_meta_data( '_noonfy_counted', 'yes' );
		$order->save_meta_data();
		$contact_id = Noonfy_Contacts::upsert_from_order( $order );
		if ( $contact_id ) {
			Noonfy_Contacts::add_order( $contact_id, (float) $order->get_total(), Noonfy_Contacts::order_date_utc( $order ) );
		}
		Noonfy_Tracking::attribute_order( $order );
	}

	/** Newsletter preference on My Account → Account details. */
	public static function account_checkbox() {
		$user    = wp_get_current_user();
		$contact = $user->ID ? Noonfy_Contacts::by_email( $user->user_email ) : null;
		$checked = $contact && 'subscribed' === $contact['marketing'];
		echo '<p class="woocommerce-form-row form-row"><label class="woocommerce-form__label woocommerce-form__label-for-checkbox">'
			. '<input type="checkbox" class="woocommerce-form__input woocommerce-form__input-checkbox" name="noonfy_optin" value="1"' . checked( $checked, true, false ) . '> '
			. '<span>' . esc_html( Noonfy_Campaign_Settings::get()['optinLabel'] ) . '</span></label>'
			. '<input type="hidden" name="noonfy_optin_shown" value="1"></p>';
	}

	/** @param int $user_id User saving their account details (WooCommerce verified the form nonce). */
	public static function save_account( $user_id ) {
		// phpcs:disable WordPress.Security.NonceVerification.Missing
		if ( empty( $_POST['noonfy_optin_shown'] ) ) {
			return;
		}
		$user = get_userdata( $user_id );
		if ( ! $user ) {
			return;
		}
		$wants   = ! empty( $_POST['noonfy_optin'] );
		$contact = Noonfy_Contacts::by_email( $user->user_email );
		// phpcs:enable
		if ( $wants && ( ! $contact || 'subscribed' !== $contact['marketing'] ) ) {
			Noonfy_Contacts::upsert( $user->user_email, array( 'user_id' => $user_id, 'first_name' => $user->first_name, 'last_name' => $user->last_name, 'source' => 'account', 'optin' => true ) );
		} elseif ( ! $wants && $contact && 'subscribed' === $contact['marketing'] ) {
			Noonfy_Contacts::set_marketing( (int) $contact['id'], 'unsubscribed' );
		}
	}
}
