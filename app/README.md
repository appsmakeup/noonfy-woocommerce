# Noonfy · SMTP & Email Delivery

React + TypeScript + Vite build of `project/SMTP.dc.html` (with the `Sidebar.dc.html` navigation) from the Claude Design handoff.

```sh
npm install
npm run dev        # http://localhost:5173/#dashboard
npm run build      # typecheck + production bundle in dist/
```

## Layout

- `src/smtp/SmtpPage.tsx`: page shell, header, tabs and hash routing (`#dashboard`, `#providers`, `#routing`, `#queue`, `#domains`, `#deliverability`, `#suppressions`, `#tools`; anything else falls back to the dashboard).
- `src/smtp/tabs/*`: one component per tab.
- `src/smtp/data.ts`: all mock data. Replace these exports with API calls when there's a backend.
- `src/smtp/useSmtpState.ts`: page-level interactive state (toggles, filters, strategy, tests, toast). It lives above the tabs so choices survive tab switches, as in the prototype. `useLiveQueue` drives the live feed (updates only while the dashboard is open).
- `src/smtp/useChart.ts`: thin Chart.js 4.4.1 wrapper.
- `src/sidebar/*`: sidebar navigation and the ⌘K / Ctrl+K command palette.
- `src/styles.css`: design tokens (`:root`) and shared classes.

## Notes vs. the prototype

- Only this page exists. Sidebar and palette links to SMTP sections become in-page hashes. Every other link keeps the prototype's `*.dc.html` path and goes nowhere until those pages are built.
- Hover states are now real CSS. In the prototype, inline colours overrode most `style-hover` rules, so many hovers never showed.
- `&amp;` in sidebar and palette labels now shows as `&`. The prototype displayed the literal entity.
- "+ Add routing rule", "+ Add sending domain" and the integration chips are visual only, as in the design.
