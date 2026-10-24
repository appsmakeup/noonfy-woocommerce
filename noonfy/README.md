# Noonfy – AI Customer Engagement (WooCommerce plugin)

WordPress plugin that adds an **AI Customer Engagement** menu to wp-admin. Its first screen is **SMTP & Email Delivery**, built from `project/SMTP.dc.html` (and the `Sidebar.dc.html` navigation) in the Claude Design handoff.

Requires WordPress 6.6+, PHP 7.4+ and WooCommerce (declared with the `Requires Plugins` header, plus a runtime guard).

## Build and install

```sh
cd noonfy
npm install
npm run build        # typecheck + build/ (smtp.js, smtp.css, smtp-rtl.css, smtp.asset.php, fonts)
npm run plugin-zip   # build + noonfy.zip ready to upload in Plugins → Add New → Upload
```

For development, symlink or copy this folder into `wp-content/plugins/noonfy` and run `npm start` (rebuilds on change). `build/` is git-ignored, so a fresh checkout must be built before activating. Without it, the screen shows an admin notice telling you so.

## How it fits together

| Piece | File |
| --- | --- |
| Plugin bootstrap, WooCommerce guard, HPOS compatibility | `noonfy.php` |
| Admin menu (`admin.php?page=noonfy-smtp`), asset enqueue, `window.noonfySmtp` boot data | `includes/class-noonfy-admin.php` |
| Settings option `noonfy_smtp_settings`: defaults + validation | `includes/class-noonfy-smtp-settings.php` |
| REST API: `GET/POST noonfy/v1/smtp/settings`, `POST noonfy/v1/smtp/test-email` | `includes/class-noonfy-smtp-rest.php` |
| Cleanup on delete | `uninstall.php` |
| React app (entry `src/index.tsx`) | `src/` |

- **Build:** `@wordpress/scripts` builds the app. React, `@wordpress/element` and `@wordpress/api-fetch` are externalised to the copies WordPress ships, and `build/smtp.asset.php` lists them as script dependencies. Chart.js and the Manrope font are bundled, so wp-admin makes no request to Google Fonts.
- **Access:** everything requires the `manage_woocommerce` capability. REST calls use the standard wp-admin nonce through `apiFetch`.
- **CSS isolation:** all classes are prefixed `nf-` and all base styles are scoped to `.nf-app`, so the app neither leaks into wp-admin nor picks up core styles like `.card` or `h1`. On this screen only, the `noonfy-admin` body class removes `#wpcontent` padding and the footer, so the app sits flush against the WP menu as in `WPAdmin.dc.html`. The Noonfy sidebar sticks below the admin bar via `--wp-admin--admin-bar--height`.
- **Sidebar links:** SMTP sections switch tabs in place (hash routing). Products, Orders (HPOS-aware), Categories and Coupons open the real WooCommerce screens. Entries for screens not built yet are inert and show "Coming soon". The footer shows the logged-in user and the site's domain.

## What's real and what's sample data

**Real:**
- These settings are saved and survive reloads: provider on/off toggles, rotation strategy, routing-rule and alert toggles, log retention, and the default from name/email (validated server-side).
- **Send test email** (header button and the first Monitoring tool) sends a message to the current user through `wp_mail()`, using the saved default sender. It reports success or the mailer's error. Success means the mailer accepted the message, not that it was delivered.
- The default sender is stored and used for test emails, but it is **not** applied to the site's other mail yet.

**Sample data, as in the design:** all metrics, charts, provider stats, logs, domains, deliverability, suppressions, the live queue feed and the other test tools. There is no sending engine behind them yet.

## Not done yet

- Translations: PHP strings use `__()`, but JS strings aren't wrapped with `@wordpress/i18n` and no `.pot` file exists.
- Provider credentials, real routing and sending, and the other Noonfy screens.
