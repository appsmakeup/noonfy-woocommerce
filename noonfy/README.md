# Noonfy – AI Customer Engagement (WooCommerce plugin)

WordPress plugin that adds an **AI Customer Engagement** menu to wp-admin. Its first screen is **SMTP & Email Delivery**: real multi-provider SMTP sending with routing, failover and logs, built from `project/SMTP.dc.html` (and the `Sidebar.dc.html` navigation) in the Claude Design handoff.

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
| Plugin bootstrap, activation (log table + daily cleanup cron), WooCommerce guard, HPOS compatibility | `noonfy.php` |
| Admin menu (`admin.php?page=noonfy-smtp`), asset enqueue, `window.noonfySmtp` boot data | `includes/class-noonfy-admin.php` |
| Sending: `pre_wp_mail` routing + failover, `phpmailer_init` SMTP config, logging, default sender, SMTP tests (`Noonfy_Mailer`); strategy ordering (`Noonfy_Router`) | `includes/class-noonfy-mailer.php` |
| Connections option `noonfy_smtp_connections`: validation, encrypted passwords | `includes/class-noonfy-connections.php`, `includes/class-noonfy-crypto.php` |
| Provider presets (host/port/encryption, fixed usernames, help text) | `includes/class-noonfy-providers.php` |
| Email log table `{prefix}noonfy_email_log`: inserts, queries, dashboard stats, purge | `includes/class-noonfy-email-log.php` |
| Settings option `noonfy_smtp_settings`: strategy, retention, default sender | `includes/class-noonfy-smtp-settings.php` |
| REST API under `noonfy/v1/smtp`: `settings`, `connections` (CRUD, `test`, `{id}/test`), `stats`, `logs`, `test-email` | `includes/class-noonfy-smtp-rest.php` |
| Cleanup on delete (options, cron, log table) | `uninstall.php` |
| React app (entry `src/index.tsx`, REST client `src/api.ts`) | `src/` |

- **Build:** `@wordpress/scripts` builds the app. React, `@wordpress/element` and `@wordpress/api-fetch` are externalised to the copies WordPress ships, and `build/smtp.asset.php` lists them as script dependencies. Chart.js and the Manrope font are bundled, so wp-admin makes no request to Google Fonts.
- **Access:** everything requires the `manage_woocommerce` capability. REST calls use the standard wp-admin nonce through `apiFetch`.
- **CSS isolation:** all classes are prefixed `nf-` and all base styles are scoped to `.nf-app`, so the app neither leaks into wp-admin nor picks up core styles like `.card` or `h1`. On this screen only, the `noonfy-admin` body class removes `#wpcontent` padding and the footer, so the app sits flush against the WP menu as in `WPAdmin.dc.html`. The Noonfy sidebar sticks below the admin bar via `--wp-admin--admin-bar--height`.
- **Sidebar links:** SMTP sections switch tabs in place (hash routing). Products, Orders (HPOS-aware), Categories and Coupons open the real WooCommerce screens. Entries for screens not built yet are inert and show "Coming soon". The footer shows the logged-in user and the site's domain.

## How sending works

1. **Routing:** with at least one connection enabled, `pre_wp_mail` (late priority, after any other plugin's short-circuit) takes over every `wp_mail()` call, WooCommerce's included. `Noonfy_Router` orders the enabled connections: the strategy picks the first one (priority, weighted, round robin, least used, fastest or health based; cost and deliverability fall back to priority for now), and the rest follow by priority. Connections at their daily limit are skipped.
2. **Failover:** each candidate is tried with a nested `wp_mail()` call, up to 3 per email, and `phpmailer_init` points PHPMailer at the current one. A failed attempt that has a next candidate is logged as `RETRY`, a final failure as `FAILED`. The original caller gets `true` as soon as one attempt succeeds.
3. **Fallback:** with no connection enabled, or every connection at its daily limit, WordPress sends normally (PHP `mail()`), and the result is still logged.
4. **Sender:** a connection's own from address wins. Otherwise the default sender replaces WordPress's `wordpress@site` default. Other plugins' senders (e.g. WooCommerce) are kept unless "override" is on. None of this applies while no connection is enabled.
5. **Timeouts:** connect 15s, and each server reply 20s (PHPMailer's default is 300s), so a stalled SMTP server can't hang a checkout.
6. **Credentials:** encrypted with libsodium using a key from `NOONFY_SECRET_KEY` (define it in `wp-config.php` to make it independent of the salts) or the site's auth salts. Changing that key means re-entering passwords. Passwords are never sent to the browser.

## What's real and what's still a preview

**Real:** connections, routing, failover, daily limits, logs, the Dashboard / Queue & Logs / Routing numbers, connection tests, test emails, the SMTP-connection and send-test-email tools, system monitoring, default sender, and log retention (purged daily by cron).

**Preview (marked "Coming soon" or "Preview" in the screen):**
- Conditional routing rules and alert rules (shown but disabled).
- Domains, Deliverability and Suppressions tabs (sample data with a banner).
- The API-credentials, DNS, spam-score and webhook tools.
- Open, click, bounce and spam rates (need tracking or provider webhooks).

## Testing

Tested end-to-end on WordPress 6.6 with MariaDB, using a local SMTP server and a placeholder `woocommerce` plugin to satisfy the dependency (real WooCommerce couldn't be downloaded in the build environment):
- **REST and sending:** every REST route, plus real email through PHPMailer, including failover, auth failures, daily limits and log/stat queries.
- **UI:** the full flow driven in a browser against that backend.

## Not done yet

- Translations: PHP strings use `__()`, but JS strings aren't wrapped with `@wordpress/i18n` and no `.pot` file exists.
- Native HTTP API transports (SendGrid/Mailgun/Postmark/SES APIs). Every provider currently connects over its SMTP relay.
- Async queue (Action Scheduler), routing rules, alerts, webhooks for bounces and complaints, DNS checks, and the other Noonfy screens.
