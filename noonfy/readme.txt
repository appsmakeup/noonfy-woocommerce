=== Noonfy – AI Customer Engagement ===
Contributors: noonfy
Tags: woocommerce, email marketing, smtp, deliverability, automation
Requires at least: 6.6
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Email marketing, automation and multi-provider SMTP delivery for WooCommerce stores.

== Description ==

Adds an **AI Customer Engagement** menu to wp-admin with the SMTP & Email Delivery screen.

* Connect SMTP providers: Amazon SES, Postmark, Mailgun, Brevo, SendGrid, Google Workspace, Microsoft 365 and 14 more presets, or any SMTP server. Credentials are encrypted at rest.
* Every WordPress and WooCommerce email is sent through your connections, chosen by routing strategy (priority, weighted, round robin, least used, fastest, health based), with automatic failover (up to 3 attempts per email) and per-connection daily limits.
* Every email is logged, with searchable logs, a live feed, volume charts and per-provider success rates and send times.
* Connection tests (SMTP handshake and authentication), test emails, a default sender, and log retention with daily cleanup.

With no connection enabled, WordPress keeps sending email as before (still logged).

Still in preview (clearly marked in the screen): conditional routing rules, alerts, DNS checks, deliverability and bounce/complaint tracking.

Requires WooCommerce.

== Changelog ==

= 0.2.0 =
* Real SMTP sending: connections, routing strategies, automatic failover, daily limits.
* Email log table with live dashboard, logs, stats and log retention.
* Fixed link colours and the modal close button being overridden by base styles.

= 0.1.0 =
* First build of the SMTP & Email Delivery screen.
