# Noonfy – AI Customer Engagement (WooCommerce plugin)

WordPress plugin that adds an **AI Customer Engagement** menu to wp-admin. Its screens are **SMTP & Email Delivery** (real multi-provider SMTP sending with routing, failover and logs) and **Email Campaigns** (builder, audiences, scheduled batched sending, tracking and revenue attribution), built from `project/SMTP.dc.html` (and the `Sidebar.dc.html` navigation) in the Claude Design handoff (plus `project/Campaigns.dc.html` for campaigns).

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
| Admin menu (SMTP, Campaigns, Automations screens), asset enqueue, boot data | `includes/class-noonfy-admin.php` |
| Sending: `pre_wp_mail` routing + failover, `phpmailer_init` SMTP config, logging, default sender, SMTP tests (`Noonfy_Mailer`); strategy ordering (`Noonfy_Router`) | `includes/class-noonfy-mailer.php` |
| Connections option `noonfy_smtp_connections`: validation, encrypted passwords | `includes/class-noonfy-connections.php`, `includes/class-noonfy-crypto.php` |
| Provider presets (host/port/encryption, fixed usernames, help text) | `includes/class-noonfy-providers.php` |
| Email log table `{prefix}noonfy_email_log`: inserts, queries, dashboard stats, purge | `includes/class-noonfy-email-log.php` |
| Settings option `noonfy_smtp_settings`: strategy, retention, default sender | `includes/class-noonfy-smtp-settings.php` |
| REST API under `noonfy/v1/smtp`: `settings`, `connections` (CRUD, `test`, `{id}/test`), `stats`, `logs`, `test-email` | `includes/class-noonfy-smtp-rest.php` |
| Schema install/upgrade for all tables (`noonfy_db_version`) | `includes/class-noonfy-install.php` |
| Contacts `{prefix}noonfy_contacts`: consent state, segments, WooCommerce customer sync | `includes/campaigns/class-noonfy-contacts.php` |
| Campaign settings (audience mode, checkout opt-in, footer address, batch size) | `includes/campaigns/class-noonfy-campaign-settings.php` |
| Campaigns + recipients tables, block validation, stats | `includes/campaigns/class-noonfy-campaigns.php` |
| Email HTML renderer (table layout, merge tags, link tracking, mandatory footer) | `includes/campaigns/class-noonfy-email-renderer.php` |
| Scheduling and batched sending (WP-Cron, claim-based, lock per campaign) | `includes/campaigns/class-noonfy-campaign-sender.php` |
| Open pixel, signed click redirects, unsubscribe page (incl. RFC 8058 one-click), revenue attribution | `includes/campaigns/class-noonfy-tracking.php` |
| WooCommerce hooks: checkout opt-in (classic + blocks), My Account preference, contacts from orders, paid-order attribution | `includes/campaigns/class-noonfy-woo-integration.php` |
| REST API under `noonfy/v1/campaigns` | `includes/campaigns/class-noonfy-campaigns-rest.php` |
| Workflows, enrollments, automation sends and step events: storage, graph validation, stats | `includes/automations/class-noonfy-workflows.php` |
| Runner: enrolment, moving contacts through steps, automation emails, conversions (WP-Cron every 5 minutes) | `includes/automations/class-noonfy-automation-runner.php` |
| Triggers: store events, cart/browse/no-order/lifetime-spend scans, segment enrolment | `includes/automations/class-noonfy-automation-triggers.php` |
| Cart capture, cart restore links, product-view tracking | `includes/automations/class-noonfy-carts.php` |
| Automation settings (cart capture, checkout notice, view tracking) | `includes/automations/class-noonfy-automation-settings.php` |
| Template gallery (42 entries, 20 buildable) | `includes/automations/class-noonfy-automation-templates.php` |
| REST API under `noonfy/v1/automations` | `includes/automations/class-noonfy-automations-rest.php` |
| Cleanup on delete (options, cron, all tables) | `uninstall.php` |
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

## How campaigns work

1. **Contacts** come from WooCommerce: every order creates or updates the buyer's contact. Ticking the checkout checkbox (classic checkout hook, or the block checkout's Additional Checkout Fields API, WooCommerce 8.9+) or the My Account preference subscribes them. "Sync WooCommerce customers" backfills existing orders. Importing customers as subscribers requires the store to confirm it has their consent.
2. **Audience mode:** in "opt-in only" (default) campaigns reach `subscribed` contacts; in "all customers" they also reach customers who never opted in. Unsubscribed contacts are never sent to, and consent is re-checked just before each email.
3. **Sending:** starting a campaign snapshots the audience into `{prefix}noonfy_campaign_recipients`. WP-Cron batches claim rows, render each email with `Noonfy_Email_Renderer` and send it with `wp_mail()`, so it goes through Noonfy's SMTP routing and email log. Admin screens nudge overdue batches when they poll, so sending progresses on quiet sites. If no connection can send (none enabled, or all at their daily limit), recipients stay queued and are retried every 15 minutes. Campaigns never use PHP `mail()`.
4. **Compliance:** every email carries the store address, an unsubscribe link (`?noonfy_unsub=token`: GET shows a confirmation, POST unsubscribes) and `List-Unsubscribe` / `List-Unsubscribe-Post` headers for one-click unsubscribe.
5. **A/B tests:** the campaign's `ab` config holds the variant B subject (and preview text) or variant B content, version names, the winner metric (opens, clicks or revenue per email), the test group size (10–50%) and the wait (1–48h). At start, a shuffled test group is queued half as A and half as B, and everyone else is `held`. When the test group has been sent, the campaign waits (`ab_phase` = `waiting`). At `ab_decide_at` (or on "Send A/B" / "End test now"), the leader on the metric (A on a tie) becomes `ab_winner`, and held recipients are queued with that variant. Per-variant stats, and a two-proportion z-test confidence for open and click rates, are shown in the builder and on the A/B tab.
6. **Tracking:** an open pixel (`?noonfy_o`) and click redirects (`?noonfy_c`, HMAC-signed over the destination so they can't be used as open redirects). A click sets a 7-day cookie, which is captured on the order at checkout. When an order is paid, its revenue goes to that recipient, or else to the most recent campaign the same email address opened or clicked within 5 days.

## How automations work

1. **Workflows** are graphs edited in the visual builder: a trigger, then delay, email, condition (yes/no), wait-for-event (yes when it happens, no on timeout), A/B split, goal and exit steps, joined by edges from each step's output ports. A workflow goes live only if it has a connected trigger, at least one email, subjects on every email and no loops. Live workflows can be edited (an edit that would break them isn't saved); contacts on a deleted step leave.
2. **Enrollment:** one row per contact trip in `{prefix}noonfy_enrollments`, unique per workflow + contact + `ref` (the event, e.g. `order:123`, `cart:12:…`, `lapse:2026-01-02`). Workflows without re-entry use an empty ref, so one trip per contact ever. Nobody is in the same workflow twice at once. Only contacts who may get marketing email join: subscribed contacts always; in the "all customers" audience mode also customers, and shoppers in cart/browse workflows (they gave their email at checkout under the saved-cart notice, or are signed in).
3. **Triggers:** subscribe (`noonfy_contact_subscribed`, fired by `Noonfy_Contacts` on consent changes), order paid (`noonfy_order_paid`, first-order and minimum-total options), order completed, no order in N days and lifetime spend (daily scan; spend also on each paid order), cart abandoned and browse abandoned (scans every 5 minutes), and segment (enrolled on activation and on "Enrol now").
4. **Carts:** while a live workflow uses abandoned carts, carts are saved at the end of requests that change them (`woocommerce_cart_updated`, Store API customer updates), for signed-in customers and for guests once their email is known (classic checkout refreshes totals when the email changes; the block checkout pushes it through the Store API). Guests see a notice under the email field (classic) or above the checkout (blocks). A cart is abandoned when unchanged for the workflow's delay (carts up to 7 days old); placing an order marks it ordered. `?noonfy_cart=token` refills the cart and opens it. Product views are stored only for signed-in shoppers (not staff) while a browse workflow is live. Old carts and views are deleted daily.
5. **Running:** due enrollments (next_run_at passed, workflow live) are advanced under a single lock: delay and wait steps hold the contact; email, condition, split and exit act immediately. Emails render with the campaign renderer (products can come from the cart, viewed products, the order or its cross-sells; buttons can reopen the saved cart) and go out with `wp_mail()` through the SMTP routing. With no usable connection the contact waits on the email step and it is retried every 15 minutes, never with PHP `mail()`. Pausing a workflow holds everyone in place. Unsubscribing removes a contact from every workflow.
6. **Results:** opens and clicks are tracked per automation send (`?noonfy_o=a<id>`, `?noonfy_c=a<id>`), and paid orders are attributed to whichever email — campaign or automation — the buyer clicked (cookie) or most recently opened or clicked within 5 days. An order from an enrolled contact who has been emailed counts as a conversion; if the workflow has a goal step, the contact jumps there and continues (e.g. to a thank-you email). Cart and browse workflows end when the shopper orders. Every step entered (and branch taken) is an event, which feeds the per-step stats, journey funnels and drop-offs (contacts who left without converting, by the last email they got).

## What's real and what's still a preview

**Real:** connections, routing, failover, daily limits, logs, the Dashboard / Queue & Logs / Routing numbers, connection tests, test emails, the SMTP-connection and send-test-email tools, system monitoring, default sender, and log retention (purged daily by cron).

**Campaigns:** everything above is real, including A/B tests. AI subject lines are marked "Coming soon".

**Automations:** workflows, builder, triggers, carts, templates, detail and journey analytics are real. SMS steps and the 22 templates that need data Noonfy doesn't collect yet (birthdays, stock and price alerts, loyalty, AI predictions…) are marked "Coming soon".

**Preview (marked "Coming soon" or "Preview" in the screen):**
- Conditional routing rules and alert rules (shown but disabled).
- Domains, Deliverability and Suppressions tabs (sample data with a banner).
- The API-credentials, DNS, spam-score and webhook tools.
- Open, click, bounce and spam rates (need tracking or provider webhooks).

## Testing

Tested end-to-end on WordPress 6.6 with MariaDB, using a local SMTP server. Real WooCommerce couldn't be downloaded in the build environment, so a placeholder `woocommerce` plugin stood in, faking the few WooCommerce functions Noonfy calls (products, orders, prices).
- **SMTP:** every REST route, plus real email through PHPMailer, including failover, auth failures, daily limits and log/stat queries.
- **A/B testing:** test-group split, variant subjects and content, waiting, the automatic winner by open rate, the manual winner, rollout to the held recipients, cancelling during the wait, and duplicating.
- **Campaigns:** audiences and consent modes, preview and test sends, scheduling and unscheduling, batched sending to the right contacts, personalisation, unsubscribe headers and page, open and click tracking, revenue attribution, and the daily-limit wait.
- **Automations:** every template validates; subscribe, order paid/completed, cart, browse, no-order, lifetime-spend and segment triggers; delays, conditions (both branches), goal jumps, exits, re-entry rules, consent per audience mode, unsubscribe, the SMTP-unavailable wait and retry, cart capture from the checkout email, the restore link, open/click tracking and attribution for automation emails, drop-off stats, validation, pause, duplicate and delete.
- **UI:** all three screens driven in a browser against that backend, including dragging, connecting and deleting steps in the builder, auto-save, the email step editor and activation errors.
- **Not covered:** the WooCommerce hooks against real WooCommerce (checkout checkbox, block checkout field, order status changes, cart events, the checkout email notice). Check these on a real store.

## Not done yet

- Translations: PHP strings use `__()`, but JS strings aren't wrapped with `@wordpress/i18n` and no `.pot` file exists.
- Native HTTP API transports (SendGrid/Mailgun/Postmark/SES APIs). Every provider currently connects over its SMTP relay.
- Automations run on WP-Cron, so timing depends on site traffic (admin screens also nudge them). On a live store, set up a real cron job hitting `wp-cron.php`.
- Async queue (Action Scheduler), routing rules, alerts, webhooks for bounces and complaints, DNS checks, and the other Noonfy screens.
