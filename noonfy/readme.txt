=== Noonfy – AI Customer Engagement ===
Contributors: noonfy
Tags: woocommerce, email marketing, smtp, deliverability, automation
Requires at least: 6.6
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.5.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Email marketing, automation and multi-provider SMTP delivery for WooCommerce stores.

== Description ==

Adds an **AI Customer Engagement** menu to wp-admin with three screens: **SMTP & Email Delivery**, **Email Campaigns** and **Automations**.

= Automations =

* Visual workflow builder: drag steps onto a canvas and connect them — trigger, delay, email, condition (yes/no), wait for an order/open/click, A/B split, goal and exit. Auto-saves, test runs to your inbox, and the same email builder as campaigns.
* Triggers: contact subscribes, order paid (first order / minimum total), order completed, no order in N days, lifetime spend reached, abandoned cart, browse abandonment (signed-in shoppers) and everyone in a segment.
* Abandoned carts: saved for signed-in customers and for guests once they type their email at checkout, with a notice under the email field. Emails show the cart's products and a button that refills the cart.
* 20 ready-made templates (welcome series, cart and checkout recovery, browse abandonment, first purchase, cross-sell, upsell, win-back, VIP, review request, shipping and delivery follow-ups, seasonal and flash sales…).
* Per-step stats, email performance, conversions and attributed revenue, contacts in each workflow, journey funnels and drop-off points.
* Respects consent and unsubscribes, never uses PHP mail(), and waits for an SMTP connection when none can send.

= Email Campaigns =

* Drag-and-drop email builder: header, image (media library), text, WooCommerce products, button, countdown, review, coupon and footer blocks, all editable in place, with desktop and mobile views and a server-rendered preview.
* Audiences from your WooCommerce customers: all subscribers, customers, repeat customers, recent buyers, lapsed customers, never ordered, engaged in the last 30 days.
* Consent: an opt-in checkbox at checkout (classic and block checkout) and in My Account. Choose "opt-in only" (default) or "all customers" per store.
* Test sends, send now or schedule, batched sending through your SMTP connections (never PHP mail()), pause, resume and cancel.
* Every email includes your store address, an unsubscribe link and one-click unsubscribe headers (Gmail/Yahoo bulk-sender rules). Unsubscribes are honoured everywhere.
* Open and click tracking, and revenue attribution from WooCommerce orders (after a click, or within 5 days of opening).
* A/B testing: test two subject lines or two versions of the email on a sample (10–50% of the audience). The winner by open rate, click rate or revenue per email is picked automatically after a wait you choose (or by you), then sent to everyone else. Results show per-variant numbers and statistical confidence.

= SMTP & Email Delivery =

* Connect SMTP providers: Amazon SES, Postmark, Mailgun, Brevo, SendGrid, Google Workspace, Microsoft 365 and 14 more presets, or any SMTP server. Credentials are encrypted at rest.
* Every WordPress and WooCommerce email is sent through your connections, chosen by routing strategy (priority, weighted, round robin, least used, fastest, health based), with automatic failover (up to 3 attempts per email) and per-connection daily limits.
* Every email is logged, with searchable logs, a live feed, volume charts and per-provider success rates and send times.
* Connection tests (SMTP handshake and authentication), test emails, a default sender, and log retention with daily cleanup.

With no connection enabled, WordPress keeps sending email as before (still logged).

Privacy: when cart capture is on, mention in your privacy policy that carts and checkout emails are saved to send reminders.

Still in preview (clearly marked in the screen): SMS steps, AI subject lines, conditional routing rules, alerts, DNS checks, deliverability and bounce/complaint tracking.

Requires WooCommerce.

== Changelog ==

= 0.5.0 =
* Automations: workflows list, visual builder, email step editor, 20 templates, detail and journey analytics.
* Triggers: subscribe, order paid, order completed, no order in N days, lifetime spend, abandoned cart (with checkout email capture and notice), browse abandonment, segment.
* Opens, clicks and revenue attribution for automation emails; cart restore links; dynamic products (cart, viewed, ordered, cross-sells) in emails.

= 0.4.0 =
* A/B testing for campaigns: subject line or email content, configurable test group, wait time and winner metric, automatic or manual winner, A/B results tab.

= 0.3.0 =
* Email Campaigns: builder, audiences, consent and opt-in, test/schedule/send, batched sending, unsubscribe, open/click tracking, revenue attribution.
* Campaigns never fall back to PHP mail(): they wait if every SMTP connection is at its daily limit.

= 0.2.0 =
* Real SMTP sending: connections, routing strategies, automatic failover, daily limits.
* Email log table with live dashboard, logs, stats and log retention.
* Fixed link colours and the modal close button being overridden by base styles.

= 0.1.0 =
* First build of the SMTP & Email Delivery screen.
