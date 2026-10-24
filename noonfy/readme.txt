=== Noonfy – AI Customer Engagement ===
Contributors: noonfy
Tags: woocommerce, email marketing, smtp, deliverability, automation
Requires at least: 6.6
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.3.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Email marketing, automation and multi-provider SMTP delivery for WooCommerce stores.

== Description ==

Adds an **AI Customer Engagement** menu to wp-admin with two screens: **SMTP & Email Delivery** and **Email Campaigns**.

= Email Campaigns =

* Drag-and-drop email builder: header, image (media library), text, WooCommerce products, button, countdown, review, coupon and footer blocks, all editable in place, with desktop and mobile views and a server-rendered preview.
* Audiences from your WooCommerce customers: all subscribers, customers, repeat customers, recent buyers, lapsed customers, never ordered, engaged in the last 30 days.
* Consent: an opt-in checkbox at checkout (classic and block checkout) and in My Account. Choose "opt-in only" (default) or "all customers" per store.
* Test sends, send now or schedule, batched sending through your SMTP connections (never PHP mail()), pause, resume and cancel.
* Every email includes your store address, an unsubscribe link and one-click unsubscribe headers (Gmail/Yahoo bulk-sender rules). Unsubscribes are honoured everywhere.
* Open and click tracking, and revenue attribution from WooCommerce orders (after a click, or within 5 days of opening).

= SMTP & Email Delivery =

* Connect SMTP providers: Amazon SES, Postmark, Mailgun, Brevo, SendGrid, Google Workspace, Microsoft 365 and 14 more presets, or any SMTP server. Credentials are encrypted at rest.
* Every WordPress and WooCommerce email is sent through your connections, chosen by routing strategy (priority, weighted, round robin, least used, fastest, health based), with automatic failover (up to 3 attempts per email) and per-connection daily limits.
* Every email is logged, with searchable logs, a live feed, volume charts and per-provider success rates and send times.
* Connection tests (SMTP handshake and authentication), test emails, a default sender, and log retention with daily cleanup.

With no connection enabled, WordPress keeps sending email as before (still logged).

Still in preview (clearly marked in the screen): A/B testing, AI subject lines, conditional routing rules, alerts, DNS checks, deliverability and bounce/complaint tracking.

Requires WooCommerce.

== Changelog ==

= 0.3.0 =
* Email Campaigns: builder, audiences, consent and opt-in, test/schedule/send, batched sending, unsubscribe, open/click tracking, revenue attribution.
* Campaigns never fall back to PHP mail(): they wait if every SMTP connection is at its daily limit.

= 0.2.0 =
* Real SMTP sending: connections, routing strategies, automatic failover, daily limits.
* Email log table with live dashboard, logs, stats and log retention.
* Fixed link colours and the modal close button being overridden by base styles.

= 0.1.0 =
* First build of the SMTP & Email Delivery screen.
