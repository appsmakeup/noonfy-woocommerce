<?php
/**
 * Provider presets for SMTP connections.
 *
 * @package Noonfy
 */

defined( 'ABSPATH' ) || exit;

/**
 * Known email providers and their SMTP relay settings.
 *
 * `username` set means the provider uses a fixed SMTP username (e.g. SendGrid's "apikey").
 */
class Noonfy_Providers {

	/** @return array<string, array> Presets keyed by id. */
	public static function all() {
		$p = static function ( $label, $host, $port, $enc, $mark, $tint, $fg, $user_label, $pass_label, $help, $username = '' ) {
			return array(
				'label'         => $label,
				'host'          => $host,
				'port'          => $port,
				'encryption'    => $enc,
				'mark'          => $mark,
				'tint'          => $tint,
				'fg'            => $fg,
				'usernameLabel' => $user_label,
				'passwordLabel' => $pass_label,
				'help'          => $help,
				'username'      => $username,
			);
		};

		return array(
			'ses'          => $p( 'Amazon SES', 'email-smtp.us-east-1.amazonaws.com', 587, 'tls', 'SES', '#FFF3E8', '#C2620A', 'SMTP username', 'SMTP password', 'Create SMTP credentials in the SES console (they differ from IAM access keys). Change the region in the host if needed.' ),
			'postmark'     => $p( 'Postmark', 'smtp.postmarkapp.com', 587, 'tls', 'PM', '#FDF3D7', '#B45309', 'Server API token', 'Server API token', 'Use your Server API token as both the username and the password.' ),
			'mailgun'      => $p( 'Mailgun', 'smtp.mailgun.org', 587, 'tls', 'MG', '#FDEDED', '#E02424', 'SMTP login', 'SMTP password', 'For EU domains use smtp.eu.mailgun.org. The login looks like postmaster@your-domain.' ),
			'brevo'        => $p( 'Brevo', 'smtp-relay.brevo.com', 587, 'tls', 'BR', '#EDF9F1', '#0E9F6E', 'SMTP login', 'SMTP key', 'Find the login and generate an SMTP key under SMTP & API in Brevo.' ),
			'sendgrid'     => $p( 'SendGrid', 'smtp.sendgrid.net', 587, 'tls', 'SG', '#EEF0FE', '#4F46E5', 'Username', 'API key', 'The username is always "apikey"; the password is an API key with Mail Send permission.', 'apikey' ),
			'google'       => $p( 'Google Workspace / Gmail', 'smtp.gmail.com', 587, 'tls', 'GW', '#F1EBFE', '#7C3AED', 'Email address', 'App password', 'Requires 2-Step Verification and an app password. Google limits daily sending.' ),
			'microsoft365' => $p( 'Microsoft 365 / Outlook', 'smtp.office365.com', 587, 'tls', 'MS', '#EEF0FE', '#2563EB', 'Email address', 'Password', 'SMTP AUTH must be enabled for the mailbox in Microsoft 365 admin.' ),
			'sparkpost'    => $p( 'SparkPost', 'smtp.sparkpostmail.com', 587, 'tls', 'SP', '#FFF3E8', '#EA580C', 'Username', 'API key', 'The username is always "SMTP_Injection".', 'SMTP_Injection' ),
			'smtp2go'      => $p( 'SMTP2GO', 'mail.smtp2go.com', 2525, 'tls', 'S2', '#EEF0FE', '#1D4ED8', 'SMTP username', 'SMTP password', 'Create an SMTP user under Sending → SMTP Users.' ),
			'mailjet'      => $p( 'Mailjet', 'in-v3.mailjet.com', 587, 'tls', 'MJ', '#FDF3D7', '#CA8A04', 'API key', 'Secret key', 'Use your API key as the username and the secret key as the password.' ),
			'elasticemail' => $p( 'Elastic Email', 'smtp.elasticemail.com', 2525, 'tls', 'EE', '#EDF9F1', '#047857', 'Username', 'Password', 'Create SMTP credentials under Settings → Create SMTP Credentials.' ),
			'mailersend'   => $p( 'MailerSend', 'smtp.mailersend.net', 587, 'tls', 'MS', '#EDF9F1', '#059669', 'SMTP username', 'SMTP password', 'Generate SMTP credentials for your domain in MailerSend.' ),
			'resend'       => $p( 'Resend', 'smtp.resend.com', 465, 'ssl', 'RS', '#F3F3FA', '#14152A', 'Username', 'API key', 'The username is always "resend".', 'resend' ),
			'zeptomail'    => $p( 'ZeptoMail', 'smtp.zeptomail.com', 587, 'tls', 'ZM', '#FDEDED', '#DC2626', 'Username', 'Send mail token', 'The username is always "emailapikey".', 'emailapikey' ),
			'mandrill'     => $p( 'Mandrill', 'smtp.mandrillapp.com', 587, 'tls', 'MD', '#EEF0FE', '#4338CA', 'Username', 'API key', 'Any string works as the username; use a Mandrill API key as the password.' ),
			'mailtrap'     => $p( 'Mailtrap', 'live.smtp.mailtrap.io', 587, 'tls', 'MT', '#EDF9F1', '#16A34A', 'Username', 'API token', 'Sending (not testing) SMTP. The username is always "api".', 'api' ),
			'socketlabs'   => $p( 'SocketLabs', 'smtp.socketlabs.com', 587, 'tls', 'SL', '#EEF0FE', '#2563EB', 'Username', 'Password', 'Use the SMTP credentials from your SocketLabs server.' ),
			'turbosmtp'    => $p( 'TurboSMTP', 'pro.turbo-smtp.com', 587, 'tls', 'TS', '#FFF3E8', '#C2410C', 'Consumer key', 'Consumer secret', 'Use your TurboSMTP consumer key and secret.' ),
			'zoho'         => $p( 'Zoho Mail', 'smtp.zoho.com', 465, 'ssl', 'ZO', '#FDF3D7', '#B45309', 'Email address', 'Password or app password', 'Use smtp.zoho.eu for EU accounts.' ),
			'scaleway'     => $p( 'Scaleway TEM', 'smtp.tem.scaleway.com', 587, 'tls', 'SC', '#F1EBFE', '#6D28D9', 'Project ID', 'API secret key', 'The username is your Scaleway project ID.' ),
			'smtp'         => $p( 'Other SMTP server', '', 587, 'tls', 'SMTP', '#F3F3FA', '#3C3F55', 'Username', 'Password', 'Any SMTP server. Leave the username empty if it does not require authentication.' ),
		);
	}

	/**
	 * @param string $id Preset id.
	 * @return array|null
	 */
	public static function get( $id ) {
		$all = self::all();
		return $all[ $id ] ?? null;
	}
}
