import { createRoot, StrictMode } from '@wordpress/element';
import { AutomationsPage } from './automations/AutomationsPage';
import { CampaignsPage } from './campaigns/CampaignsPage';
import { SmtpPage } from './smtp/SmtpPage';
// Manrope is bundled locally (no request to Google Fonts from wp-admin).
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import './styles.css';

// One bundle for every Noonfy screen: the mount point PHP printed decides which one renders.
const screens = [
  ['noonfy-smtp-root', SmtpPage],
  ['noonfy-campaigns-root', CampaignsPage],
  ['noonfy-automations-root', AutomationsPage],
] as const;

for (const [id, Screen] of screens) {
  const el = document.getElementById(id);
  if (el) {
    createRoot(el).render(
      <StrictMode>
        <Screen />
      </StrictMode>,
    );
  }
}
