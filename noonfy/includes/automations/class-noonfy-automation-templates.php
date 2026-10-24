<?php
/**
 * Ready-made workflows for the template gallery.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Each available template builds a complete graph — trigger, delays, conditions and emails with starter
 * copy — that the store edits in the builder before activating. Templates that need data Noonfy doesn't
 * collect yet (birthdays, stock alerts, loyalty points, AI predictions…) are listed as coming soon.
 */
class Noonfy_Automation_Templates {

	/** Gallery categories, in order. */
	const CATEGORIES = array( 'Recovery', 'Lifecycle', 'Revenue', 'Loyalty', 'Merchandising', 'Post-purchase', 'Campaigns', 'AI-powered' );

	/** @return array[] id, name, cat, glyph, tint, desc, popular, available, emails, graph (available only). */
	public static function all() {
		$P = '#F1EBFE';
		$B = '#EEF0FE';
		$O = '#FFF3E8';
		$G = '#EDF9F1';
		$R = '#FDEDED';
		$t = static function ( $id, $name, $cat, $glyph, $tint, $desc, $popular = false ) {
			return compact( 'id', 'name', 'cat', 'glyph', 'tint', 'desc', 'popular' );
		};
		$list = array(
			$t( 'welcome', __( 'Welcome Series', 'noonfy' ), 'Lifecycle', '👋', $P, __( 'Greet new subscribers, tell your story and drive the first order.', 'noonfy' ), true ),
			$t( 'cart', __( 'Cart Recovery', 'noonfy' ), 'Recovery', '🛒', $B, __( 'Win back abandoned carts with reminders and a timed incentive.', 'noonfy' ), true ),
			$t( 'browse', __( 'Browse Abandonment', 'noonfy' ), 'Recovery', '👀', $G, __( 'Follow up when a customer views a product but never adds to cart.', 'noonfy' ), true ),
			$t( 'checkout', __( 'Checkout Recovery', 'noonfy' ), 'Recovery', '💳', $B, __( 'Recover customers who dropped off during checkout.', 'noonfy' ) ),
			$t( 'first_purchase', __( 'First Purchase', 'noonfy' ), 'Lifecycle', '🎉', $O, __( 'Turn first-time buyers into repeat customers with a warm follow-up.', 'noonfy' ) ),
			$t( 'cross_sell', __( 'Cross Sell', 'noonfy' ), 'Revenue', '🎁', $P, __( 'Recommend complementary products after each purchase.', 'noonfy' ), true ),
			$t( 'upsell', __( 'Upsell', 'noonfy' ), 'Revenue', '📈', $B, __( 'Offer premium alternatives to recent shoppers.', 'noonfy' ) ),
			$t( 'win_back', __( 'Win Back', 'noonfy' ), 'Lifecycle', '💫', $O, __( 'Re-engage customers who haven’t ordered in 90 days.', 'noonfy' ), true ),
			$t( 'vip', __( 'VIP Customers', 'noonfy' ), 'Loyalty', '👑', $P, __( 'Reward your highest-value customers with early access and perks.', 'noonfy' ) ),
			$t( 'birthday', __( 'Birthday', 'noonfy' ), 'Loyalty', '🎂', $R, __( 'Send a birthday treat that converts goodwill into an order.', 'noonfy' ) ),
			$t( 'anniversary', __( 'Anniversary', 'noonfy' ), 'Loyalty', '💜', $P, __( 'Celebrate a customer’s first-purchase anniversary.', 'noonfy' ) ),
			$t( 'review', __( 'Review Request', 'noonfy' ), 'Post-purchase', '⭐', $O, __( 'Ask for reviews at the moment of peak delight.', 'noonfy' ) ),
			$t( 'price_drop', __( 'Price Drop', 'noonfy' ), 'Merchandising', '📉', $G, __( 'Alert interested customers when a wishlisted item drops in price.', 'noonfy' ) ),
			$t( 'back_in_stock', __( 'Back In Stock', 'noonfy' ), 'Merchandising', '📦', $B, __( 'Notify waitlisted customers the moment inventory returns.', 'noonfy' ), true ),
			$t( 'replenishment', __( 'Replenishment', 'noonfy' ), 'Revenue', '🔄', $G, __( 'Remind customers to reorder consumables right on schedule.', 'noonfy' ) ),
			$t( 'subscription', __( 'Subscription Renewal', 'noonfy' ), 'Revenue', '🗓️', $B, __( 'Reduce churn with pre-renewal reminders and win-back offers.', 'noonfy' ) ),
			$t( 'recently_viewed', __( 'Recently Viewed', 'noonfy' ), 'Recovery', '🕶️', $G, __( 'Bring shoppers back to the products they lingered on.', 'noonfy' ) ),
			$t( 'category_interest', __( 'Category Interest', 'noonfy' ), 'Merchandising', '🗂️', $O, __( 'Nurture shoppers by the categories they browse most.', 'noonfy' ) ),
			$t( 'best_sellers', __( 'Best Sellers', 'noonfy' ), 'Merchandising', '🏆', $P, __( 'Showcase what everyone’s buying this month.', 'noonfy' ) ),
			$t( 'fbt', __( 'Frequently Bought Together', 'noonfy' ), 'Revenue', '🧺', $B, __( 'Bundle suggestions based on real purchase pairs.', 'noonfy' ) ),
			$t( 'seasonal', __( 'Seasonal Campaign', 'noonfy' ), 'Campaigns', '🍂', $O, __( 'A ready-made seasonal push with countdown and hero offers.', 'noonfy' ) ),
			$t( 'flash_sale', __( 'Flash Sale', 'noonfy' ), 'Campaigns', '⚡', $R, __( 'High-urgency sale sequence with live countdown timers.', 'noonfy' ), true ),
			$t( 'loyalty', __( 'Loyalty Rewards', 'noonfy' ), 'Loyalty', '🎯', $P, __( 'Points balances, tier upgrades and redemption nudges.', 'noonfy' ) ),
			$t( 'referral', __( 'Referral Program', 'noonfy' ), 'Loyalty', '🤝', $G, __( 'Turn happy customers into your acquisition channel.', 'noonfy' ) ),
			$t( 'high_value', __( 'High Value Customers', 'noonfy' ), 'Lifecycle', '💎', $B, __( 'Special treatment for customers above a spend threshold.', 'noonfy' ) ),
			$t( 'inactive', __( 'Inactive Customers', 'noonfy' ), 'Lifecycle', '😴', $O, __( 'A gentle re-permission series for long-dormant contacts.', 'noonfy' ) ),
			$t( 'product_launch', __( 'Product Launch', 'noonfy' ), 'Campaigns', '🚀', $P, __( 'Tease, reveal and follow up on a new product drop.', 'noonfy' ) ),
			$t( 'new_arrivals', __( 'New Arrivals', 'noonfy' ), 'Merchandising', '✨', $B, __( 'Weekly digest of what just landed in the store.', 'noonfy' ) ),
			$t( 'coupon_reminder', __( 'Coupon Reminder', 'noonfy' ), 'Recovery', '🎟️', $O, __( 'Nudge customers holding unused coupons before expiry.', 'noonfy' ) ),
			$t( 'shipping', __( 'Shipping Follow-up', 'noonfy' ), 'Post-purchase', '🚚', $G, __( 'Proactive shipping updates that cut support tickets.', 'noonfy' ) ),
			$t( 'delivery', __( 'Delivery Follow-up', 'noonfy' ), 'Post-purchase', '📬', $B, __( 'Check in after delivery and open the door to a review.', 'noonfy' ) ),
			$t( 'survey', __( 'Post Purchase Survey', 'noonfy' ), 'Post-purchase', '📝', $O, __( 'One-question NPS survey with smart routing.', 'noonfy' ) ),
			$t( 'negative_review', __( 'Negative Review Recovery', 'noonfy' ), 'Post-purchase', '🩹', $R, __( 'Reach unhappy reviewers before they churn for good.', 'noonfy' ) ),
			$t( 'dynamic_discounts', __( 'Dynamic Discounts', 'noonfy' ), 'AI-powered', '🧮', $P, __( 'AI-sized discounts — just enough to convert each customer.', 'noonfy' ) ),
			$t( 'ai_recommendations', __( 'AI Recommendations', 'noonfy' ), 'AI-powered', '🤖', $P, __( 'Per-customer product picks powered by the recommendation engine.', 'noonfy' ), true ),
			$t( 'predicted_purchase', __( 'Predicted Purchase', 'noonfy' ), 'AI-powered', '🔮', $P, __( 'Reach customers right before their predicted next order date.', 'noonfy' ) ),
			$t( 'geo', __( 'Geo Targeting', 'noonfy' ), 'Campaigns', '📍', $G, __( 'Localized offers by region, store proximity or shipping zone.', 'noonfy' ) ),
			$t( 'weather', __( 'Weather Campaign', 'noonfy' ), 'Campaigns', '🌤️', $B, __( 'Trigger sends off local weather — rain jackets when it pours.', 'noonfy' ) ),
			$t( 'abandoned_category', __( 'Abandoned Category', 'noonfy' ), 'Recovery', '🗑️', $O, __( 'Recover interest in a category a shopper explored then left.', 'noonfy' ) ),
			$t( 'premium_journey', __( 'Premium Customer Journey', 'noonfy' ), 'Lifecycle', '🥂', $P, __( 'A white-glove multi-touch journey for top-tier customers.', 'noonfy' ), true ),
			$t( 'sunset', __( 'Sunset Unengaged', 'noonfy' ), 'Lifecycle', '🌇', $R, __( 'Cleanly retire contacts who never open — protect deliverability.', 'noonfy' ) ),
			$t( 'holiday', __( 'Holiday Gift Guide', 'noonfy' ), 'Campaigns', '🎄', $R, __( 'A curated gifting series with segment-aware picks.', 'noonfy' ) ),
		);
		foreach ( $list as &$item ) {
			$graph             = self::graph( $item['id'] );
			$item['available'] = null !== $graph;
			$item['graph']     = $graph;
			$item['emails']    = $graph ? count( array_filter( $graph['nodes'], static function ( $n ) {
				return 'email' === $n['kind'];
			} ) ) : 0;
		}
		return $list;
	}

	/**
	 * @param string $id Template id.
	 * @return array|null name, emoji, graph — or null if unknown or not available yet.
	 */
	public static function get( $id ) {
		foreach ( self::all() as $t ) {
			if ( $t['id'] === $id && $t['available'] ) {
				return array( 'name' => $t['name'], 'emoji' => in_array( $t['glyph'], Noonfy_Workflows::EMOJIS, true ) ? $t['glyph'] : '⚡', 'graph' => $t['graph'] );
			}
		}
		return null;
	}

	/**
	 * @param string $id Template id.
	 * @return array|null Graph, or null when the template isn't available yet.
	 */
	private static function graph( $id ) {
		$shop = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/' );
		$e    = array( __CLASS__, 'email' );
		switch ( $id ) {
			case 'welcome':
				return self::flow(
					array( 'type' => 'subscribed' ),
					array(
						$e( __( 'Welcome to {site}', 'noonfy' ), __( 'Welcome, {first_name|friend}! 👋', 'noonfy' ), __( 'Thanks for joining us. You’ll be first to hear about new arrivals, offers and stories from our team.', 'noonfy' ), __( 'Start shopping', 'noonfy' ), $shop, array( 'name' => __( 'Welcome email', 'noonfy' ) ) ),
						array( 'delay', 2, 'days' ),
						$e( __( 'The story behind {site}', 'noonfy' ), __( 'How it all started', 'noonfy' ), __( 'We started this shop because we couldn’t find products we truly loved. Here’s what we stand for — and the pieces our customers come back for.', 'noonfy' ), __( 'See our favourites', 'noonfy' ), $shop, array( 'name' => __( 'Our story', 'noonfy' ) ) ),
						array( 'delay', 3, 'days' ),
						array( 'stop_if', 'ordered', __( 'Placed an order?', 'noonfy' ) ),
						$e( __( 'A little something for your first order', 'noonfy' ), __( 'Here’s 10% off', 'noonfy' ), __( 'Use this code on your first order. It’s our way of saying welcome.', 'noonfy' ), __( 'Use my code', 'noonfy' ), $shop, array( 'name' => __( 'First-order offer', 'noonfy' ), 'coupon' => 'WELCOME10' ) ),
						array( 'delay', 3, 'days' ),
						$e( __( 'Your welcome code expires soon', 'noonfy' ), __( 'Last call, {first_name|friend}', 'noonfy' ), __( 'Just a reminder — your welcome discount is still waiting for you.', 'noonfy' ), __( 'Shop now', 'noonfy' ), $shop, array( 'name' => __( 'Offer reminder', 'noonfy' ), 'coupon' => 'WELCOME10' ) ),
					)
				);
			case 'cart':
			case 'checkout':
				$checkout = 'checkout' === $id;
				return self::flow(
					array( 'type' => 'cart_abandoned', 'minutes' => $checkout ? 30 : 60 ),
					array_merge(
						array(
							$e( __( 'You left something behind', 'noonfy' ), __( 'Still thinking it over?', 'noonfy' ), __( 'Your cart is saved and ready when you are. Pick up right where you left off.', 'noonfy' ), __( 'Return to my cart', 'noonfy' ), '', array( 'name' => __( 'You left something behind', 'noonfy' ), 'products' => 'cart', 'cart' => true ) ),
							array( 'delay', 1, 'days' ),
							$e( __( 'Your cart, plus 10% off', 'noonfy' ), __( 'A little nudge', 'noonfy' ), __( 'Complete your order today and take 10% off with this code.', 'noonfy' ), __( 'Complete my order', 'noonfy' ), '', array( 'name' => __( '10% coupon reminder', 'noonfy' ), 'products' => 'cart', 'cart' => true, 'coupon' => 'COMEBACK10' ) ),
						),
						$checkout ? array() : array(
							array( 'delay', 2, 'days' ),
							$e( __( 'Last chance: your cart expires soon', 'noonfy' ), __( 'Going, going…', 'noonfy' ), __( 'We can’t hold your items forever. Your code is still valid for a little longer.', 'noonfy' ), __( 'Get my items', 'noonfy' ), '', array( 'name' => __( 'Last chance', 'noonfy' ), 'products' => 'cart', 'cart' => true, 'coupon' => 'COMEBACK10' ) ),
						),
						array( array( 'goal', __( 'Order placed', 'noonfy' ) ) )
					)
				);
			case 'browse':
			case 'recently_viewed':
				$recent = 'recently_viewed' === $id;
				return self::flow(
					array( 'type' => 'browse_abandoned', 'hours' => $recent ? 24 : 2 ),
					array_merge(
						array(
							$e( __( 'Still interested?', 'noonfy' ), __( 'Take another look', 'noonfy' ), __( 'You were checking these out. They’re still here — but popular items don’t stay in stock forever.', 'noonfy' ), __( 'Take another look', 'noonfy' ), $shop, array( 'name' => __( 'Product reminder', 'noonfy' ), 'products' => 'viewed' ) ),
						),
						$recent ? array() : array(
							array( 'delay', 1, 'days' ),
							array( 'stop_if', 'ordered', __( 'Did purchase?', 'noonfy' ) ),
							$e( __( 'Here’s 10% off what you were looking at', 'noonfy' ), __( 'Treat yourself', 'noonfy' ), __( 'Make it yours with 10% off your order.', 'noonfy' ), __( 'Shop now', 'noonfy' ), $shop, array( 'name' => __( 'Send 10% coupon', 'noonfy' ), 'products' => 'viewed', 'coupon' => 'LOOK10' ) ),
						),
						array( array( 'goal', __( 'Purchase completed', 'noonfy' ) ) )
					)
				);
			case 'first_purchase':
				return self::flow(
					array( 'type' => 'order_paid', 'firstOrder' => true ),
					array(
						array( 'delay', 1, 'days' ),
						$e( __( 'Thank you for your first order!', 'noonfy' ), __( 'Welcome to the family, {first_name|friend}', 'noonfy' ), __( 'We’re so glad you chose us. Your order is being prepared with care — here’s what to expect next.', 'noonfy' ), __( 'Visit the shop', 'noonfy' ), $shop, array( 'name' => __( 'Thank you', 'noonfy' ), 'products' => 'order' ) ),
						array( 'delay', 7, 'days' ),
						$e( __( 'Picked for you', 'noonfy' ), __( 'Goes perfectly with your order', 'noonfy' ), __( 'Customers who bought what you did also love these.', 'noonfy' ), __( 'See more', 'noonfy' ), $shop, array( 'name' => __( 'Recommendations', 'noonfy' ), 'products' => 'cross_sells' ) ),
						array( 'delay', 14, 'days' ),
						array( 'stop_if', 'orders', __( 'Ordered again?', 'noonfy' ), 2 ),
						$e( __( 'Ready for round two?', 'noonfy' ), __( 'Your next favourite is waiting', 'noonfy' ), __( 'Come back for your second order and enjoy free shipping.', 'noonfy' ), __( 'Shop again', 'noonfy' ), $shop, array( 'name' => __( 'Second order nudge', 'noonfy' ) ) ),
					)
				);
			case 'cross_sell':
				return self::flow(
					array( 'type' => 'order_completed' ),
					array(
						array( 'delay', 3, 'days' ),
						$e( __( 'Complete the look', 'noonfy' ), __( 'Made to go together', 'noonfy' ), __( 'These pair perfectly with your recent order.', 'noonfy' ), __( 'Shop the pairing', 'noonfy' ), $shop, array( 'name' => __( 'Cross-sell picks', 'noonfy' ), 'products' => 'cross_sells' ) ),
						array( 'delay', 4, 'days' ),
						array( 'stop_if', 'clicked', __( 'Clicked?', 'noonfy' ) ),
						$e( __( 'Still need these?', 'noonfy' ), __( 'A second look', 'noonfy' ), __( 'A quick reminder of the products that go best with your order.', 'noonfy' ), __( 'Browse picks', 'noonfy' ), $shop, array( 'name' => __( 'Cross-sell reminder', 'noonfy' ), 'products' => 'cross_sells' ) ),
					)
				);
			case 'upsell':
				return self::flow(
					array( 'type' => 'order_paid' ),
					array(
						array( 'delay', 5, 'days' ),
						$e( __( 'Ready for an upgrade?', 'noonfy' ), __( 'Take it to the next level', 'noonfy' ), __( 'Loving your order? These premium picks take it even further.', 'noonfy' ), __( 'See premium picks', 'noonfy' ), $shop, array( 'name' => __( 'Upgrade offer', 'noonfy' ), 'products' => 'cross_sells' ) ),
						array( 'delay', 5, 'days' ),
						array( 'stop_if', 'clicked', __( 'Clicked?', 'noonfy' ) ),
						$e( __( 'Our best, picked for you', 'noonfy' ), __( 'Worth a look', 'noonfy' ), __( 'A final look at the upgrades our customers love most.', 'noonfy' ), __( 'Shop now', 'noonfy' ), $shop, array( 'name' => __( 'Upgrade reminder', 'noonfy' ) ) ),
					)
				);
			case 'win_back':
			case 'inactive':
				$days = 'inactive' === $id ? 180 : 90;
				return self::flow(
					array( 'type' => 'no_order', 'days' => $days ),
					array(
						$e( __( 'We miss you, {first_name|friend}', 'noonfy' ), __( 'It’s been a while', 'noonfy' ), __( 'A lot has changed since your last visit — new arrivals, restocks and a few surprises.', 'noonfy' ), __( 'See what’s new', 'noonfy' ), $shop, array( 'name' => __( 'We miss you', 'noonfy' ) ) ),
						array( 'delay', 4, 'days' ),
						array( 'stop_if', 'ordered', __( 'Came back?', 'noonfy' ) ),
						$e( __( 'Here’s 15% to welcome you back', 'noonfy' ), __( 'Come back for less', 'noonfy' ), __( 'Use this code on your next order — we’d love to see you again.', 'noonfy' ), __( 'Use my code', 'noonfy' ), $shop, array( 'name' => __( 'Win-back offer', 'noonfy' ), 'coupon' => 'MISSYOU15' ) ),
						array( 'delay', 5, 'days' ),
						array( 'stop_if', 'ordered', __( 'Came back?', 'noonfy' ) ),
						'inactive' === $id
							? $e( __( 'Do you still want to hear from us?', 'noonfy' ), __( 'Stay or go — your choice', 'noonfy' ), __( 'We only want to email people who enjoy it. If you’d rather not hear from us, use the unsubscribe link below — no hard feelings.', 'noonfy' ), __( 'Keep me subscribed', 'noonfy' ), $shop, array( 'name' => __( 'Re-permission', 'noonfy' ) ) )
							: $e( __( 'Last chance for your 15% off', 'noonfy' ), __( 'Your code expires soon', 'noonfy' ), __( 'This is the last reminder about your welcome-back discount.', 'noonfy' ), __( 'Shop now', 'noonfy' ), $shop, array( 'name' => __( 'Last chance', 'noonfy' ), 'coupon' => 'MISSYOU15' ) ),
					)
				);
			case 'vip':
			case 'high_value':
			case 'premium_journey':
				$amount = array( 'vip' => 500, 'high_value' => 1000, 'premium_journey' => 2000 )[ $id ];
				$steps  = array(
					$e( __( 'You’re officially a VIP 👑', 'noonfy' ), __( 'Welcome to the inner circle', 'noonfy' ), __( 'You’re one of our most valued customers. From now on you’ll get early access to launches and members-only offers.', 'noonfy' ), __( 'Explore VIP picks', 'noonfy' ), $shop, array( 'name' => __( 'VIP welcome', 'noonfy' ) ) ),
					array( 'delay', 7, 'days' ),
					$e( __( 'Early access, just for you', 'noonfy' ), __( 'Before anyone else', 'noonfy' ), __( 'Our newest arrivals, available to VIPs first.', 'noonfy' ), __( 'Shop early access', 'noonfy' ), $shop, array( 'name' => __( 'Early access', 'noonfy' ) ) ),
				);
				if ( 'high_value' !== $id ) {
					$steps = array_merge(
						$steps,
						array(
							array( 'delay', 14, 'days' ),
							$e( __( 'A thank-you gift inside', 'noonfy' ), __( 'Because you’re amazing', 'noonfy' ), __( 'Enjoy this VIP-only code on your next order.', 'noonfy' ), __( 'Redeem my gift', 'noonfy' ), $shop, array( 'name' => __( 'VIP perk', 'noonfy' ), 'coupon' => 'VIPTHANKS' ) ),
						)
					);
				}
				if ( 'premium_journey' === $id ) {
					$steps = array_merge(
						$steps,
						array(
							array( 'delay', 14, 'days' ),
							$e( __( 'Hand-picked for you', 'noonfy' ), __( 'Your personal selection', 'noonfy' ), __( 'Our team picked these with you in mind.', 'noonfy' ), __( 'See my picks', 'noonfy' ), $shop, array( 'name' => __( 'Personal picks', 'noonfy' ), 'products' => 'cross_sells' ) ),
							array( 'delay', 30, 'days' ),
							$e( __( 'How are we doing?', 'noonfy' ), __( 'We’d love your thoughts', 'noonfy' ), __( 'As one of our best customers, your opinion shapes what we do next. Just reply to this email.', 'noonfy' ), __( 'Visit the shop', 'noonfy' ), $shop, array( 'name' => __( 'Check-in', 'noonfy' ) ) ),
						)
					);
				}
				return self::flow(
					array( 'type' => 'lifetime_spend', 'amount' => $amount ),
					$steps
				);
			case 'review':
				return self::flow(
					array( 'type' => 'order_completed' ),
					array(
						array( 'delay', 5, 'days' ),
						$e( __( 'How are you liking your order?', 'noonfy' ), __( 'Tell us what you think', 'noonfy' ), __( 'Your review helps other shoppers — and helps us get better. It takes less than a minute.', 'noonfy' ), __( 'Write a review', 'noonfy' ), $shop, array( 'name' => __( 'Review request', 'noonfy' ), 'products' => 'order' ) ),
						array( 'delay', 5, 'days' ),
						array( 'stop_if', 'clicked', __( 'Clicked?', 'noonfy' ) ),
						$e( __( 'A quick favour?', 'noonfy' ), __( 'One minute of your time', 'noonfy' ), __( 'We’d really appreciate your honest review.', 'noonfy' ), __( 'Leave a review', 'noonfy' ), $shop, array( 'name' => __( 'Review reminder', 'noonfy' ), 'products' => 'order' ) ),
					)
				);
			case 'shipping':
				return self::flow(
					array( 'type' => 'order_completed' ),
					array(
						$e( __( 'Your order is on its way', 'noonfy' ), __( 'Good things are coming', 'noonfy' ), __( 'Your order has left our hands and is heading to you. Questions about delivery? Just reply to this email.', 'noonfy' ), __( 'Visit the shop', 'noonfy' ), $shop, array( 'name' => __( 'Shipping update', 'noonfy' ), 'products' => 'order' ) ),
					)
				);
			case 'delivery':
				return self::flow(
					array( 'type' => 'order_completed' ),
					array(
						array( 'delay', 4, 'days' ),
						$e( __( 'Did everything arrive okay?', 'noonfy' ), __( 'Just checking in', 'noonfy' ), __( 'We hope your order arrived safe and sound. If anything isn’t right, reply and we’ll fix it.', 'noonfy' ), __( 'Shop again', 'noonfy' ), $shop, array( 'name' => __( 'Delivery check-in', 'noonfy' ), 'products' => 'order' ) ),
					)
				);
			case 'seasonal':
			case 'flash_sale':
			case 'product_launch':
			case 'holiday':
				$copy = array(
					'seasonal'       => array( __( 'The new season is here 🍂', 'noonfy' ), __( 'Fresh picks for the season', 'noonfy' ), __( 'Season favourites, ending soon', 'noonfy' ), __( 'Final days of the season sale', 'noonfy' ) ),
					'flash_sale'     => array( __( '⚡ Flash sale: 24 hours only', 'noonfy' ), __( 'Prices drop now', 'noonfy' ), __( 'Hours left in the flash sale', 'noonfy' ), '' ),
					'product_launch' => array( __( 'Something new is coming…', 'noonfy' ), __( 'Get ready', 'noonfy' ), __( 'It’s here: meet our newest product', 'noonfy' ), __( 'Don’t miss the launch', 'noonfy' ) ),
					'holiday'        => array( __( 'Your holiday gift guide 🎄', 'noonfy' ), __( 'Gifts they’ll love', 'noonfy' ), __( 'Gifts for everyone on your list', 'noonfy' ), __( 'Last days for holiday delivery', 'noonfy' ) ),
				)[ $id ];
				$flash = 'flash_sale' === $id;
				$steps = array(
					$e( $copy[0], $copy[1], __( 'Edit this email to introduce your offer — add products, a hero image and a coupon from the blocks on the left.', 'noonfy' ), __( 'Shop now', 'noonfy' ), $shop, array( 'name' => __( 'Announcement', 'noonfy' ), 'countdown' => $flash ) ),
					array( 'delay', $flash ? 1 : 3, 'days' ),
					array( 'stop_if', 'ordered', __( 'Placed an order?', 'noonfy' ) ),
					$e( $copy[2], $copy[1], __( 'A reminder for everyone who hasn’t ordered yet.', 'noonfy' ), __( 'Shop now', 'noonfy' ), $shop, array( 'name' => __( 'Reminder', 'noonfy' ), 'countdown' => $flash ) ),
				);
				if ( ! $flash ) {
					$steps = array_merge(
						$steps,
						array(
							array( 'delay', 3, 'days' ),
							array( 'stop_if', 'ordered', __( 'Placed an order?', 'noonfy' ) ),
							$e( $copy[3], $copy[1], __( 'Last chance before it’s gone.', 'noonfy' ), __( 'Shop now', 'noonfy' ), $shop, array( 'name' => __( 'Last chance', 'noonfy' ) ) ),
						)
					);
				}
				return self::flow( array( 'type' => 'segment', 'segment' => 'all' ), $steps );
		}
		return null;
	}

	/**
	 * Email step with starter content.
	 *
	 * @param string $subject Subject.
	 * @param string $title   Header title.
	 * @param string $body    Paragraph.
	 * @param string $label   Button label.
	 * @param string $url     Button URL.
	 * @param array  $o       name, products (source), cart (restore button), coupon, countdown.
	 * @return array Step spec.
	 */
	public static function email( $subject, $title, $body, $label, $url, array $o = array() ) {
		$site    = wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES );
		$subject = str_replace( '{site}', $site, $subject );
		$blocks  = array(
			array( 'id' => 'b1', 'type' => 'header', 'eyebrow' => strtoupper( $site ), 'title' => $title ),
			array( 'id' => 'b2', 'type' => 'text', 'html' => esc_html__( 'Hi {first_name|there},', 'noonfy' ) . '<br><br>' . esc_html( $body ) ),
		);
		if ( ! empty( $o['products'] ) ) {
			$blocks[] = array( 'id' => 'b3', 'type' => 'products', 'source' => $o['products'], 'productIds' => array() );
		}
		if ( ! empty( $o['countdown'] ) ) {
			$blocks[] = array( 'id' => 'b4', 'type' => 'countdown', 'until' => gmdate( 'c', time() + 2 * DAY_IN_SECONDS ) );
		}
		if ( ! empty( $o['coupon'] ) ) {
			/* translators: shown under a coupon code in a template email */
			$blocks[] = array( 'id' => 'b5', 'type' => 'coupon', 'code' => $o['coupon'], 'note' => __( 'Create this code in WooCommerce → Marketing → Coupons', 'noonfy' ) );
		}
		$blocks[] = array( 'id' => 'b6', 'type' => 'button', 'label' => $label, 'url' => $url, 'dest' => empty( $o['cart'] ) ? 'url' : 'cart' );
		$blocks[] = array( 'id' => 'b7', 'type' => 'footer' );
		return array(
			'email',
			$o['name'] ?? $subject,
			array(
				'subject'   => $subject,
				'preheader' => '',
				'content'   => array( 'accent' => '#4F46E5', 'blocks' => $blocks ),
			),
		);
	}

	/**
	 * Lays steps out top to bottom. `stop_if` adds a condition whose "yes" branch exits to the right and
	 * whose "no" branch continues.
	 *
	 * @param array $trigger Trigger settings.
	 * @param array $steps   Step specs: [email, name, settings], [delay, n, unit], [stop_if, check, name, value?], [goal, name].
	 * @return array Graph.
	 */
	private static function flow( array $trigger, array $steps ) {
		$x     = 160;
		$y     = 40;
		$n     = 1;
		// Trigger and delay steps are left unnamed: the builder labels them from their settings, so the
		// label stays right when the settings change.
		$nodes = array( array( 'id' => 'n1', 'kind' => 'trigger', 'name' => '', 'x' => $x, 'y' => $y, 'settings' => $trigger ) );
		$edges = array();
		$prev  = array( 'n1', 'out' );
		foreach ( $steps as $s ) {
			$y   += 'delay' === $s[0] ? 120 : 140;
			$id   = 'n' . ( ++$n );
			$node = array( 'id' => $id, 'x' => $x, 'y' => $y );
			switch ( $s[0] ) {
				case 'email':
					$node += array( 'kind' => 'email', 'name' => $s[1], 'settings' => $s[2] );
					break;
				case 'delay':
					$node += array( 'kind' => 'delay', 'name' => '', 'settings' => array( 'amount' => $s[1], 'unit' => $s[2] ) );
					break;
				case 'stop_if':
					$node += array( 'kind' => 'condition', 'name' => $s[2], 'settings' => array( 'check' => $s[1], 'value' => $s[3] ?? 0 ) );
					break;
				case 'goal':
					$node += array( 'kind' => 'goal', 'name' => $s[1], 'settings' => array() );
					break;
			}
			$nodes[] = $node;
			$edges[] = array( 'from' => $prev[0], 'to' => $id, 'port' => $prev[1] );
			$prev    = array( $id, 'out' );
			if ( 'stop_if' === $s[0] ) {
				$exit    = 'n' . ( ++$n );
				$nodes[] = array( 'id' => $exit, 'kind' => 'exit', 'name' => __( 'Exit workflow', 'noonfy' ), 'x' => $x + 300, 'y' => $y + 140, 'settings' => array() );
				$edges[] = array( 'from' => $id, 'to' => $exit, 'port' => 'yes' );
				$prev    = array( $id, 'no' );
			}
		}
		return Noonfy_Workflows::sanitize_graph( array( 'nodes' => $nodes, 'edges' => $edges ) );
	}
}
