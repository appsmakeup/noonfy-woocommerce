import type { StrategyKey } from './smtp/data';

/** Settings the plugin persists in the `noonfy_smtp_settings` option (see includes/class-noonfy-smtp-settings.php). */
export interface PersistedSettings {
  strategy: StrategyKey;
  rules: Record<string, boolean>;
  alerts: Record<string, boolean>;
  retention: number;
  fromName: string;
  fromEmail: string;
  forceFrom: boolean;
}

export type Encryption = 'none' | 'ssl' | 'tls';

/** Provider preset (includes/class-noonfy-providers.php). `username` set = fixed SMTP username. */
export interface Preset {
  label: string; host: string; port: number; encryption: Encryption;
  mark: string; tint: string; fg: string;
  usernameLabel: string; passwordLabel: string; help: string; username: string;
}

export interface Connection {
  id: string; provider: string; name: string; host: string; port: number; encryption: Encryption;
  username: string; hasPassword: boolean; fromEmail: string; fromName: string;
  priority: number; weight: number; dailyLimit: number; enabled: boolean; createdAt: number;
  lastTest: { at: number; ok: boolean; latencyMs: number | null; error: string | null } | null;
}

/** Fields the connection form sends; `password` blank = keep the saved one. */
export type ConnectionInput = Omit<Connection, 'id' | 'hasPassword' | 'createdAt' | 'lastTest'> & { password: string };

export interface ConnectionPerf { attempts?: number; avgLatency?: number | null; successRate?: number | null; sentToday?: number }

export interface Stats {
  sentToday: number; failedToday: number; retriedToday: number; sentYesterday: number; sentMonth: number;
  lastHour: number; totalLogged: number;
  successRate30: number | null; failedRate30: number | null; avgLatency7: number | null; p95Latency7: number | null;
  volume14: { label: string; sent: number; failed: number }[];
  shareMonth: { connectionId: string; provider: string; name: string; count: number }[];
  perConnection: Record<string, ConnectionPerf>;
}

export type LogStatus = 'SENT' | 'RETRY' | 'FAILED';
export interface LogRow {
  id: number; time: string; to: string; subject: string; connectionId: string; provider: string;
  connectionName: string; status: LogStatus; attempt: number; latencyMs: number | null; error: string | null;
}

export interface TestResult { ok: boolean; latencyMs: number | null; error: string | null }

/** SMTP screen data, bootstrapped as `window.noonfySmtp` (Noonfy_Admin::smtp_data). */
export interface NoonfyConfig {
  restPath: string;
  settings: PersistedSettings;
  presets: Record<string, Preset>;
  connections: Connection[];
  stats: Stats;
  recentLogs: LogRow[];
  system: { purgeScheduled: boolean; openssl: boolean; php: string; wordpress: string; woocommerce: string };
}

/** Shared by every Noonfy screen, bootstrapped as `window.noonfyApp` (Noonfy_Admin::app_data). */
export interface AppConfig {
  user: { name: string; initials: string; email: string };
  site: { name: string; host: string; home: string };
  /** wp-admin URLs of Noonfy's own screens. */
  screens: { smtp: string; campaigns: string; automations: string };
  /** Real wp-admin URLs for sidebar entries that map onto WordPress/WooCommerce screens. */
  links: Record<string, string>;
}

declare global {
  interface Window { noonfySmtp?: NoonfyConfig; noonfyApp?: AppConfig }
}

export const app: AppConfig = window.noonfyApp ?? {
  user: { name: '', initials: '', email: '' },
  site: { name: '', host: '', home: '/' },
  screens: { smtp: '', campaigns: '', automations: '' },
  links: {},
};

const EMPTY_STATS: Stats = {
  sentToday: 0, failedToday: 0, retriedToday: 0, sentYesterday: 0, sentMonth: 0, lastHour: 0, totalLogged: 0,
  successRate30: null, failedRate30: null, avgLatency7: null, p95Latency7: null, volume14: [], shareMonth: [], perConnection: {},
};

const FALLBACK: NoonfyConfig = {
  restPath: 'noonfy/v1/smtp',
  settings: { strategy: 'priority', rules: {}, alerts: {}, retention: 30, fromName: '', fromEmail: '', forceFrom: false },
  presets: {}, connections: [], stats: EMPTY_STATS, recentLogs: [],
  system: { purgeScheduled: false, openssl: false, php: '', wordpress: '', woocommerce: '' },
};

export const config: NoonfyConfig = window.noonfySmtp ?? FALLBACK;
