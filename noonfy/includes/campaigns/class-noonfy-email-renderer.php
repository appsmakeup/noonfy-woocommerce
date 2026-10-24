<?php
/**
 * Renders campaign blocks to email HTML.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Produces table-based HTML with inline styles (what email clients support), mirroring the builder.
 * The builder canvas in src/campaigns/Canvas.tsx draws the same blocks; keep the two visually in sync.
 *
 * Context keys:
 * - contact: first_name, last_name, email (for merge tags)
 * - link: callable( string $url ): string, used to rewrite every link (click tracking)
 * - unsubscribe_url: string
 * - pixel_url: string|null (open tracking)
 */
class Noonfy_Email_Renderer {

	const FONT = "'Manrope',Helvetica,Arial,sans-serif";

	/**
	 * @param array $campaign subject, preheader, content.
	 * @param array $ctx      See class doc.
	 * @return string Full HTML document.
	 */
	public static function render( array $campaign, array $ctx ) {
		$content = Noonfy_Campaigns::sanitize_content( $campaign['content'] ?? array() );
		$accent  = $content['accent'];
		$ctx    += array(
			'contact'         => array(),
			'link'            => static function ( $u ) {
				return $u;
			},
			'unsubscribe_url' => '#',
			'pixel_url'       => null,
		);

		$rows       = '';
		$has_footer = false;
		foreach ( $content['blocks'] as $block ) {
			$has_footer = $has_footer || 'footer' === $block['type'];
			$rows      .= self::block( $block, $accent, $ctx );
		}
		// Every marketing email carries the address and an unsubscribe link, even if the footer block was removed.
		if ( ! $has_footer ) {
			$rows .= self::block( array( 'type' => 'footer' ), $accent, $ctx );
		}

		$subject   = esc_html( self::merge( (string) ( $campaign['subject'] ?? '' ), $ctx['contact'] ) );
		$preheader = esc_html( self::merge( (string) ( $campaign['preheader'] ?? '' ), $ctx['contact'] ) );
		$pixel     = $ctx['pixel_url'] ? '<img src="' . esc_url( $ctx['pixel_url'] ) . '" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">' : '';
		$font      = self::FONT;

		return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">'
			. "<title>{$subject}</title>"
			. '<style>@media (max-width:620px){.nf-w{width:100%!important}.nf-col{display:block!important;width:100%!important;padding:0 0 12px 0!important}}</style></head>'
			. '<body style="margin:0;padding:0;background:#F6F6FB;-webkit-text-size-adjust:100%">'
			. ( $preheader ? '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">' . $preheader . '</div>' : '' )
			. '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F6FB"><tr><td align="center" style="padding:24px 12px">'
			. "<table role=\"presentation\" class=\"nf-w\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"width:600px;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:{$font}\">"
			. $rows
			. '</table></td></tr></table>' . $pixel . '</body></html>';
	}

	/**
	 * Replaces {first_name}, {last_name} and {email}; `{first_name|there}` gives a fallback.
	 *
	 * @param string $text    Text.
	 * @param array  $contact Contact fields.
	 * @return string
	 */
	public static function merge( $text, array $contact ) {
		return preg_replace_callback(
			'/\{(first_name|last_name|email)(?:\|([^}]*))?\}/',
			static function ( $m ) use ( $contact ) {
				$v = trim( (string) ( $contact[ $m[1] ] ?? '' ) );
				return '' !== $v ? $v : ( $m[2] ?? '' );
			},
			$text
		);
	}

	/**
	 * @param string $accent Hex colour.
	 * @return string Second gradient colour (the design's violet for the default accent).
	 */
	public static function accent2( $accent ) {
		if ( '#4f46e5' === strtolower( $accent ) ) {
			return '#8B5CF6';
		}
		$hex = ltrim( $accent, '#' );
		if ( 3 === strlen( $hex ) ) {
			$hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
		}
		$mix = static function ( $i ) use ( $hex ) {
			$c = hexdec( substr( $hex, $i, 2 ) );
			return str_pad( dechex( (int) round( $c + ( 255 - $c ) * 0.3 ) ), 2, '0', STR_PAD_LEFT );
		};
		return '#' . $mix( 0 ) . $mix( 2 ) . $mix( 4 );
	}

	/**
	 * @param array  $b      Block.
	 * @param string $accent Accent colour.
	 * @param array  $ctx    Context.
	 * @return string One or more <tr> rows.
	 */
	private static function block( array $b, $accent, array $ctx ) {
		$c    = $ctx['contact'];
		$t    = static function ( $s ) use ( $c ) {
			return esc_html( self::merge( (string) $s, $c ) );
		};
		$link = $ctx['link'];
		$grad = 'background:' . $accent . ';background-image:linear-gradient(135deg,' . $accent . ',' . self::accent2( $accent ) . ')';

		switch ( $b['type'] ) {
			case 'header':
				return '<tr><td style="' . $grad . ';padding:26px 24px;text-align:center">'
					. ( '' !== ( $b['eyebrow'] ?? '' ) ? '<div style="font-size:12px;font-weight:800;letter-spacing:2px;color:rgba(255,255,255,.75)">' . $t( $b['eyebrow'] ) . '</div>' : '' )
					. '<div style="font-size:23px;line-height:1.3;font-weight:800;color:#ffffff;margin-top:8px;letter-spacing:-.3px">' . $t( $b['title'] ?? '' ) . '</div></td></tr>';

			case 'image':
				if ( empty( $b['src'] ) ) {
					return '';
				}
				$img = '<img src="' . esc_url( $b['src'] ) . '" alt="' . esc_attr( $b['alt'] ?? '' ) . '" width="588" style="display:block;width:100%;max-width:588px;height:auto;border:0;border-radius:6px">';
				return '<tr><td style="padding:2px 6px">' . ( ! empty( $b['link'] ) ? '<a href="' . esc_url( $link( $b['link'] ) ) . '" target="_blank">' . $img . '</a>' : $img ) . '</td></tr>';

			case 'text':
				$html = self::merge( (string) ( $b['html'] ?? '' ), array_map( 'esc_html', $c ) );
				$html = preg_replace_callback(
					'/<a\s+href="([^"]*)"/i',
					static function ( $m ) use ( $link, $accent ) {
						return '<a style="color:' . $accent . '" target="_blank" href="' . esc_url( $link( html_entity_decode( $m[1] ) ) ) . '"';
					},
					$html
				);
				return '<tr><td style="padding:18px 24px;font-size:14px;line-height:1.65;color:#3C3F55;font-weight:500">' . $html . '</td></tr>';

			case 'products':
				return self::products( $b['productIds'] ?? array(), $accent, $link );

			case 'button':
				$url = ! empty( $b['url'] ) ? $b['url'] : home_url( '/' );
				return '<tr><td style="padding:16px 24px;text-align:center"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="' . $grad . ';border-radius:10px">'
					. '<a href="' . esc_url( $link( $url ) ) . '" target="_blank" style="display:inline-block;padding:12px 34px;font-size:14px;font-weight:800;color:#ffffff;text-decoration:none">' . $t( $b['label'] ?? '' ) . '</a></td></tr></table></td></tr>';

			case 'countdown':
				$left = strtotime( (string) ( $b['until'] ?? '' ) ) - time();
				if ( $left <= 0 ) {
					return '<tr><td style="padding:16px 24px;text-align:center;font-size:13px;font-weight:800;color:#8A8DA3">' . esc_html__( 'This offer has ended.', 'noonfy' ) . '</td></tr>';
				}
				$units = array(
					array( (int) floor( $left / DAY_IN_SECONDS ), __( 'DAYS', 'noonfy' ) ),
					array( (int) floor( ( $left % DAY_IN_SECONDS ) / HOUR_IN_SECONDS ), __( 'HRS', 'noonfy' ) ),
					array( (int) floor( ( $left % HOUR_IN_SECONDS ) / MINUTE_IN_SECONDS ), __( 'MIN', 'noonfy' ) ),
				);
				$cells = '';
				foreach ( $units as $u ) {
					$cells .= '<td style="padding:0 5px"><div style="background:#14152A;color:#ffffff;border-radius:9px;padding:10px 13px;font-size:16px;font-weight:800;text-align:center">'
						. str_pad( (string) $u[0], 2, '0', STR_PAD_LEFT ) . '<div style="font-size:8.5px;font-weight:700;color:#A5A8BD;letter-spacing:1px">' . esc_html( $u[1] ) . '</div></div></td>';
				}
				return '<tr><td style="padding:16px 24px" align="center"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' . $cells . '</tr></table></td></tr>';

			case 'reviews':
				return '<tr><td style="padding:14px 24px"><div style="background:#F8F8FC;border-radius:11px;padding:14px 16px">'
					. '<div style="font-size:12px;color:#F59E0B;letter-spacing:2px">' . str_repeat( '★', (int) ( $b['stars'] ?? 5 ) ) . '</div>'
					. '<div style="font-size:13px;color:#3C3F55;font-weight:600;line-height:1.55;margin-top:6px">“' . $t( $b['quote'] ?? '' ) . '”</div>'
					. ( '' !== ( $b['author'] ?? '' ) ? '<div style="font-size:11px;font-weight:800;color:#A5A8BD;margin-top:6px;text-transform:uppercase">— ' . $t( $b['author'] ) . '</div>' : '' )
					. '</div></td></tr>';

			case 'coupon':
				return '<tr><td style="padding:14px 24px"><div style="border:1.5px dashed ' . self::accent2( $accent ) . ';background:#FBFAFF;border-radius:11px;padding:14px;text-align:center">'
					. '<div style="font-size:11px;font-weight:800;color:' . $accent . ';letter-spacing:1px">' . esc_html__( 'YOUR CODE', 'noonfy' ) . '</div>'
					. '<div style="font-size:19px;font-weight:800;color:#14152A;letter-spacing:3px;margin-top:4px">' . esc_html( $b['code'] ?? '' ) . '</div>'
					. ( '' !== ( $b['note'] ?? '' ) ? '<div style="font-size:11px;font-weight:700;color:#8A8DA3;margin-top:3px">' . $t( $b['note'] ) . '</div>' : '' )
					. '</div></td></tr>';

			case 'footer':
				$settings = Noonfy_Campaign_Settings::get();
				$host     = (string) wp_parse_url( home_url(), PHP_URL_HOST );
				$reason   = 'optin' === $settings['audienceMode']
					/* translators: %s: site domain */
					? sprintf( __( 'You’re receiving this because you subscribed at %s.', 'noonfy' ), $host )
					/* translators: %s: site name */
					: sprintf( __( 'You’re receiving this because you’re a customer of %s.', 'noonfy' ), wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ) );
				$unsub    = esc_url( $ctx['unsubscribe_url'] );
				return '<tr><td style="background:#F8F8FC;padding:18px 24px;text-align:center;font-size:11px;color:#A5A8BD;font-weight:600;line-height:1.7">'
					. ( '' !== $settings['companyAddress'] ? esc_html( $settings['companyAddress'] ) . '<br>' : '' )
					. esc_html( $reason ) . '<br>'
					. '<a href="' . $unsub . '" style="color:#8A8DA3;text-decoration:underline">' . esc_html__( 'Unsubscribe', 'noonfy' ) . '</a> · '
					. '<a href="' . $unsub . '" style="color:#8A8DA3;text-decoration:underline">' . esc_html__( 'Preferences', 'noonfy' ) . '</a></td></tr>';
		}
		return '';
	}

	/**
	 * Product cards (live name, price, image and link at render time).
	 *
	 * @param int[]    $ids    Product ids.
	 * @param string   $accent Accent colour.
	 * @param callable $link   Link rewriter.
	 * @return string
	 */
	private static function products( array $ids, $accent, $link ) {
		$cards = array();
		foreach ( self::product_data( $ids ) as $p ) {
			$img     = $p['image'] ? '<img src="' . esc_url( $p['image'] ) . '" alt="" width="264" style="display:block;width:100%;height:auto;border:0">' : '<div style="height:86px;background:#EDF9F1"></div>';
			$cards[] = '<a href="' . esc_url( $link( $p['url'] ) ) . '" target="_blank" style="display:block;text-decoration:none;border:1px solid #ECEDF4;border-radius:10px;overflow:hidden">' . $img
				. '<div style="padding:9px 11px"><div style="font-size:12px;font-weight:800;color:#14152A">' . esc_html( $p['name'] ) . '</div>'
				. '<div style="font-size:12px;font-weight:700;color:' . $accent . ';margin-top:2px">' . esc_html( $p['price'] ) . '</div></div></a>';
		}
		if ( ! $cards ) {
			return '';
		}
		$rows = '';
		foreach ( array_chunk( $cards, 2 ) as $pair ) {
			$rows .= '<tr>';
			foreach ( $pair as $i => $card ) {
				$rows .= '<td class="nf-col" width="50%" valign="top" style="width:50%;padding:0 ' . ( 0 === $i ? '6px' : '0' ) . ' 12px ' . ( 0 === $i ? '0' : '6px' ) . '">' . $card . '</td>';
			}
			$rows .= 1 === count( $pair ) ? '<td class="nf-col" width="50%" style="width:50%"></td>' : '';
			$rows .= '</tr>';
		}
		return '<tr><td style="padding:10px 24px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' . $rows . '</table></td></tr>';
	}

	/**
	 * @param int[] $ids Product ids.
	 * @return array[] id, name, price (plain text), image, url — published products only.
	 */
	public static function product_data( array $ids ) {
		if ( ! function_exists( 'wc_get_product' ) ) {
			return array();
		}
		$out = array();
		foreach ( $ids as $id ) {
			$product = wc_get_product( $id );
			if ( ! $product || 'publish' !== $product->get_status() ) {
				continue;
			}
			$out[] = array(
				'id'    => $product->get_id(),
				'name'  => $product->get_name(),
				'price' => html_entity_decode( wp_strip_all_tags( wc_price( (float) $product->get_price() ) ), ENT_QUOTES ),
				'image' => (string) wp_get_attachment_image_url( $product->get_image_id(), 'woocommerce_thumbnail' ),
				'url'   => $product->get_permalink(),
			);
		}
		return $out;
	}
}
