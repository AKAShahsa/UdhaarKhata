# CLAUDE.md — Udhaar Khata project rules

Offline, mobile-first credit/payment ledger for small shops. Served as static files from the repo root on GitHub Pages.

## Hard constraints
- **Plain HTML, CSS and JavaScript only.** No build step, no bundler, no frameworks, no npm dependencies.
- **No external requests.** No CDNs, web fonts, analytics or remote APIs. The only outbound link is `https://wa.me/` opened by the Remind button.
- **Relative paths only** (`./js/app.js`, `icons/...`) so the app works under `https://<user>.github.io/<repo>/`.
- **All UI text in English.**
- Must work offline and stay installable as a PWA.

## Architecture
- `js/money.js` — pure functions (no DOM, no storage): balances, due/overdue logic, filters, dashboard stats, formatting/parsing. UMD: `window.UKMoney` in the browser, `require()` in node.
- `js/store.js` — data model, `localStorage` load/save (key `udhaarkhata.v1`), backup validation (`normalize`), CSV, demo data. UMD: `window.UKStore`.
- `js/app.js` — UI only. Hash routes: `#/`, `#/customers`, `#/customer/:id`, `#/statement/:id`, `#/settings`. Event delegation via `data-action` attributes.
- Put new business logic in `money.js`/`store.js` with tests, not in `app.js`.

## Money and dates
- Store amounts as **integers in minor units** (Rs 12,500 → `1250000`). Never store floats. Use `parseAmount` for input and `formatMoney` for display (`Rs 12,500`, decimals only when non-zero).
- Dates are local `YYYY-MM-DD` strings; compare them as strings. Use `toISODate`/`addDays`, never `toISOString()` (UTC shifts the day).
- Entry types are exactly `"gave"` (credit, increases balance) and `"got"` (payment, decreases balance). Positive balance = customer owes the shop.
- Overdue = balance > 0 and the earliest due date of credits still unpaid (payments applied oldest-first) is before today.

## Security / data safety
- Escape every user-provided string with `esc()` before putting it in `innerHTML`. Prefer `textContent` where possible.
- Destructive actions (delete customer/entry, restore, demo over existing data, reset) always go through `confirmDialog`.
- The PIN is stored only as a salted SHA-256 hash (`pinHash`); backups strip it and restore keeps the current one.
- Changing the stored data shape requires bumping `VERSION` in `store.js` and migrating in `normalize`.

## Service worker
- When you add, rename or change any shipped file, **bump `CACHE` in `sw.js`** and keep the `ASSETS` list complete, otherwise installed phones keep the old version.

## UI
- Mobile-first; touch targets at least 48px; no horizontal scroll at 360px width.
- Colors come from CSS variables in `styles.css`; any new color needs light and dark values (both the `prefers-color-scheme` block and `[data-theme="dark"]`).
- Charts are hand-written inline SVG.

## Before committing
- Run `node --test` — all tests must pass.
- For UI changes, serve with `python3 -m http.server` and check the affected screens on a phone-sized viewport in light and dark mode.
