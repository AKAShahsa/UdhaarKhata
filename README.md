# Udhaar Khata

A simple, mobile-first credit (udhaar) and payment ledger for small shops. Record what you give on credit and what customers pay back, see who owes you what, send polite WhatsApp reminders and print statements — all on your phone, even without internet.

- **No account, no server.** Your data is saved only on your device.
- **Works offline** and installs like an app on Android (PWA).
- **Plain HTML, CSS and JavaScript.** No build step, no external CDNs.

## Features

| Area | What you get |
| --- | --- |
| Customers | Add, edit, delete (name, phone, note). Search, sort by highest balance / name / recent activity, filters: All · Owes me · Overdue · Settled |
| Entries | **You gave** (credit) and **You got** (payment) with amount, date, note and optional due date. Running balance after every entry. Edit or delete with confirmation |
| Dashboard | Total to collect, collected this month, customers with dues, overdue list, top 5 debtors, 30-day credit vs payment chart |
| Reminders | WhatsApp button opens `wa.me` with a polite pre-filled message (shop name, balance, due date). Template editable in Settings |
| Statement | Printable customer statement with your shop name on top — Print or Save as PDF, any date range |
| Settings | Shop name, phone, currency (default `Rs`), WhatsApp country code, reminder template, light/dark theme, optional 4-digit PIN lock |
| My data | Backup to JSON and restore, export CSV for Excel, load demo data, reset everything |

## Put it online with GitHub Pages

1. Push this repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and the `/ (root)` folder, then **Save**.
4. After a minute your app is live at `https://<your-username>.github.io/<repo-name>/`.

## Install on Android

1. Open the app link in **Chrome**.
2. Tap **⋮ → Add to Home screen** (or **Install app**).
3. Open Udhaar Khata from your home screen. It runs full-screen and works without internet.

## Daily usage guide

**First time**
1. Go to **Settings** and enter your shop name and phone. These appear on reminders and statements.
2. Want to look around first? Tap **Load demo data** (you can **Reset** later).

**Add a customer** — Tap **+ Add customer**, enter a name (phone is needed for WhatsApp and calls), and save.

**Record credit** — Open the customer and tap the red **You gave** button. Enter the amount, date, an optional note (e.g. "Flour 20kg") and an optional due date (quick buttons: 7 / 15 / 30 days).

**Record a payment** — Tap the green **You got** button and enter the amount received.

**Fix a mistake** — Tap any entry to edit it, or tap **Delete** inside it. The balance is recalculated automatically.

**Reading the balance**
- Red amount = the customer owes you (**You will get**).
- Green amount = the customer paid extra (**Advance**).
- **Overdue** = money is still pending after the due date. Payments are applied to the oldest credit first.

**Send a reminder** — On the customer page tap **Remind**. WhatsApp opens with a polite message ready to send. Change the wording in **Settings → WhatsApp reminder** using placeholders:

| Placeholder | Becomes |
| --- | --- |
| `{name}` | Customer name |
| `{shop}` | Your shop name |
| `{balance}` | Pending balance, e.g. `Rs 12,500` |
| `{due}` | `, due on 5 Nov 2026` — or nothing if there is no due date |
| `{duedate}` | `5 Nov 2026` — or `as soon as possible` |
| `{shopphone}` | Your shop phone |

Numbers starting with `0` (e.g. `0300-1234567`) get your country code added (default `92`).

**Print a statement** — Customer page → **Statement**. Pick a date range and tap **Print / Save as PDF**. In the print dialog choose **Save as PDF** to share it on WhatsApp.

**Lock the app** — **Settings → Security → Set PIN**. The app asks for the PIN when opened and after being in the background for more than a minute. If you forget the PIN, the only way in is to erase the data on this device and restore a backup.

## Keep your data safe

Your data lives in this browser on this phone only. Clearing browser data, uninstalling Chrome or losing the phone will lose it.

- Tap **Settings → Backup (JSON)** regularly (e.g. weekly) and keep the file on Google Drive or send it to yourself on WhatsApp.
- To move to a new phone: open the app there, **Restore backup**, and pick the file.
- **Export CSV (Excel)** gives you a spreadsheet of every entry with running balances.

## Development

No dependencies or build tools are needed.

```bash
# run locally (any static server works)
python3 -m http.server 8080      # then open http://localhost:8080

# run the unit tests (Node 18+)
node --test
```

Project layout:

```
index.html            app shell
styles.css            all styles (light/dark, print)
js/money.js           pure balance math and money formatting (unit tested)
js/store.js           storage, backup/restore, CSV, demo data (unit tested)
js/app.js             UI: routing, screens, forms, PIN, WhatsApp, printing
sw.js                 service worker for offline use
manifest.webmanifest  PWA manifest
icons/                app icons
tests/                node --test unit tests
```

See [CLAUDE.md](CLAUDE.md) for project rules.
