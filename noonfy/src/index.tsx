import { createRoot, StrictMode } from '@wordpress/element';
import { SmtpPage } from './smtp/SmtpPage';
// Manrope is bundled locally (no request to Google Fonts from wp-admin).
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import './styles.css';

const el = document.getElementById('noonfy-smtp-root');
if (el) {
  createRoot(el).render(
    <StrictMode>
      <SmtpPage />
    </StrictMode>,
  );
}
