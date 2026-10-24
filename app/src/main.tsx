import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SmtpPage } from './smtp/SmtpPage';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SmtpPage />
  </StrictMode>,
);
