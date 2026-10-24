import type { StrategyKey } from './smtp/data';

/** Settings the plugin persists in the `noonfy_smtp_settings` option (see includes/class-noonfy-smtp-settings.php). */
export interface PersistedSettings {
  enabled: Record<string, boolean>;
  strategy: StrategyKey;
  rules: Record<string, boolean>;
  alerts: Record<string, boolean>;
  retention: number;
  fromName: string;
  fromEmail: string;
}

/** Bootstrapped by PHP as `window.noonfySmtp` (see Noonfy_Admin::enqueue_assets). */
export interface NoonfyConfig {
  restPath: string;
  settings: PersistedSettings;
  user: { name: string; initials: string; email: string };
  site: { name: string; host: string };
  /** Real wp-admin URLs for sidebar entries that map onto WordPress/WooCommerce screens. */
  links: Record<string, string>;
}

declare global {
  interface Window { noonfySmtp?: NoonfyConfig }
}

const FALLBACK: NoonfyConfig = {
  restPath: 'noonfy/v1/smtp',
  settings: { enabled: {}, strategy: 'weighted', rules: {}, alerts: {}, retention: 30, fromName: '', fromEmail: '' },
  user: { name: '', initials: '', email: '' },
  site: { name: '', host: '' },
  links: {},
};

export const config: NoonfyConfig = window.noonfySmtp ?? FALLBACK;
