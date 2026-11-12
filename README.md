# USC Transport Department — Transport Admin Assistant

A web application for the University of the Southern Caribbean Transport Department to manage, track, and report on transport requests.

Built with React, Firebase, and Vite. Deployed via Cloudflare Pages.

---

## Features

### Transport Request Form
Public-facing form for submitting transport requests. Supports department and student modes with cost centre autocomplete, pickup location suggestions, and round-trip scheduling. Includes a 5 working days advance notice after submission.

### Interactive Calendar
Year-at-a-glance view showing all 12 months simultaneously. Each day displays colour-coded dots for assigned drivers. Click a day to view all trips; click a trip to see full details.

### Pending Jobs
Manage incoming requests — approve, cancel, edit details, assign drivers, or delete jobs. Real-time status filtering with pagination. Includes:
- **Contact Client** — Call or email the client directly (Gmail forced, auto-detects 4-digit phone extensions)
- **Email Prompts** — Send acceptance or decline emails with branded USC Transport templates (dates formatted as words, 12hr clock)
- **Mark as Completed** — Moves job to Past Jobs with confirmation modal

### Past Jobs
Browse completed jobs with search, date sorting, and monthly grouping. Edit trip details inline, assign drivers with autocomplete, manage financial fields (amount, currency, account code), and contact clients directly.

### Export Reports
Generate Excel workbooks for any date range with preset 25th-to-25th monthly periods. Output includes:
- **Completed Jobs sheet** — Date, Acct Code, Account Name, Fund, Function, Transaction Description, Amount, Currency
- **Cancelled Jobs sheet** — Separate tab for cancelled trips
- Auto-sized column widths, total sum row, and preview with cancelled trip count

### Authentication
Two roles — Admin and Driver — authenticated via Firebase with email/password. Admin sees all views; Driver sees only the Calendar.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Build | Vite 6 |
| Database | Firestore (via Firebase) |
| Auth | Firebase Authentication |
| Styling | Inline styles (no framework) |
| Icons | Lucide React |
| Export | SheetJS (xlsx) |
| Hosting | Cloudflare Pages |

---

## Firestore Collection

All data is stored in a `Requests` collection with documents containing: type, status, assignedDriver, contact info, trip details, service type, financial fields (amount, currency, account code), and timestamps.

---

Made by **Aalon Peters** · 2026 · Version 1.2
