# PennyWise — Personal Money Tracker

> **Better Money, Brighter Future.**
A personal finance tracker for Filipinos that covers everyday income and expenses, multiple accounts, and a built-in *utang* (debt) and bills ledger called **ListaPay**.

**Live URL:** `https://pennywise-pm.vercel.app/`
**Repository:** [PennyWise on GitHub](https://github.com/brieninocencio/PennyWise--Personal-Money-Tracker-App)

Built for **Elec 3 – Technical Elective III (Software Development)**, Computer Engineering Department, President Ramon Magsaysay State University — project activity *"From Code to Cloud."*

---

## Table of Contents

1. [Project Description](#1-project-description)

1. [Features](#2-features)

1. [Tech Stack and Why](#3-tech-stack-and-why)

1. [System Architecture](#4-system-architecture)

1. [File Structure and Purpose of Each File](#5-file-structure-and-purpose-of-each-file)

1. [How the Accounting Works](#6-how-the-accounting-works)

1. [Database Design (Supabase)](#7-database-design-supabase)

1. [Authentication and Cloud Sync Flow](#8-authentication-and-cloud-sync-flow)

1. [Security](#9-security)

1. [Run Locally](#10-run-locally)

1. [Testing](#11-testing)

1. [Deployment Steps](#12-deployment-steps)

1. [Development Workflow (Git)](#13-development-workflow-git)

1. [Requirement Mapping](#14-requirement-mapping)

1. [Known Limitations and Future Work](#15-known-limitations-and-future-work)

---

## 1. Project Description

PennyWise helps you see **where your money goes and who owes you what**. After signing in, the Dashboard summarizes your total balance, this month's income and expenses, budget progress, and spending by category. Transactions, Accounts, and ListaPay each have their own page.

The problem it solves: many people track money in a notes app or chat thread, and utang (informal loans to friends, barkada, or relatives) gets forgotten because it never touches any record. PennyWise keeps everyday spending **and** utang in one place, and makes sure the two stay consistent — lending money creates a linked transaction, and every repayment updates both the debt and the account balance.

---

## 2. Features

| Area | What it does |
| --- | --- |
| **Authentication** | Email/password sign-up with a unique username, login, and **Sign in with Google**, powered by Supabase Auth. |
| **Dashboard** | Total balance, income and expenses for the current month, monthly budget meter, spending-by-category donut chart, and the five most recent transactions. |
| **Transactions** | Create, read, update, and delete **income**, **expense**, and **transfer** records. Search plus filters by type, account, and category. |
| **Accounts** | Cash, bank, e-wallet, and card accounts. Balances are *calculated* from transactions, never typed in. Deleting an account requires moving its history elsewhere so no money is created or lost. |
| **ListaPay** | A ledger for **people** who owe you, **groups** (per-member amounts), and **bills** you must pay. Supports partial and full payments, overdue tracking, and due-soon notifications. |
| **Linked records** | Lending creates a "Loan Given" transaction; repayments create "Loan Repayment" transactions; paying a bill creates an expense. These are re-derived from the debt record, so they cannot drift apart. |
| **Budgeting** | A monthly budget with a progress meter that turns red when exceeded. |
| **Notifications** | A bell showing debts and bills that are overdue or due within 3 days. |
| **Cloud sync** | Your data follows your account across devices. Each user sees only their own rows (row-level security). |
| **Responsive design** | Collapsible sidebar on desktop, floating bottom navigation and bottom-sheet dialogs on mobile. |
| **Data safety** | Duplicate-submit guard, input validation, money math in integer cents, local backup before any data migration. |

---

## 3. Tech Stack and Why

| Layer | Technology | Why this choice |
| --- | --- | --- |
| **Frontend** | HTML5, CSS3, **Vanilla JavaScript** (ES2018+) | No build step and no dependencies to maintain. Multi-page structure keeps each screen simple, and it demonstrates core web fundamentals. |
| **Styling** | Custom CSS design system (`css/styles.css`, `css/auth.css`), Poppins font | Design tokens in `:root` give a consistent look across pages. CSS Grid/Flexbox with breakpoints at 1024 / 768 / 375 px make it usable on phones. |
| **Backend (BaaS)** | **Supabase** (PostgreSQL + Auth + Row Level Security) | Provides a real hosted SQL database, secure password hashing, Google OAuth, and per-user data isolation without running and securing a custom server. Authorization is enforced **in the database** through RLS policies, which is safer than trusting client code. |
| **Dev server** | **Node.js** (`server.js`, built-in `http` module only) | A tiny static server for local development, with path-traversal protection and security headers. No npm packages required. |
| **Hosting** | **Vercel** (static hosting) | The deployed site is served at the `vercel.app` URL listed above. Vercel serves the static frontend while Supabase provides authentication and database services. |
| **Version control** | **Git + GitHub** | Feature branches, pull requests, and a commit history that records development from early stages to deployment. |
| **Testing** | Node `assert` (no framework) | The accounting logic is isolated in `store.js` so it can be tested in plain Node with a mocked `localStorage`. |
| **Libraries** | `@supabase/supabase-js` v2 (loaded from jsDelivr CDN) | The only third-party runtime library. |

### Why a "BaaS" backend instead of a custom API?

PennyWise's backend is **Supabase**: PostgreSQL stores the data, Supabase Auth handles identity, and RLS policies act as the authorization layer. The browser talks to it through the Supabase client with the *public anon key* — safe by design because every table is locked down by RLS and the anon role has no table privileges. This removes a whole class of mistakes (hand-written auth, SQL injection, leaked secrets) while still giving a real, hosted, multi-user database.

---

## 4. System Architecture

```
┌──────────────────────────── Browser ─────────────────────────────┐
│                                                                   │
│  *.html pages (shell)                                             │
│     │                                                             │
│     ▼                                                             │
│  auth-boot.js  ── auth gate + cloud adapter                       │
│     │  1. checks Supabase session (else → auth.html)              │
│     │  2. loads the user's cloud snapshot into localStorage       │
│     │  3. then loads store.js and app.js                          │
│     ▼                                                             │
│  store.js (window.PW)  ◄── all money logic, validation, CRUD      │
│     ▲        │                                                    │
│     │        ▼ writes financeApp_* keys                           │
│  app.js (UI)      localStorage  ← fast working cache              │
│  renders pages,        │                                          │
│  modals, forms         │ setItem/removeItem hook (debounced 650ms)│
│                        ▼                                          │
│                  auth-boot.js ── one JSONB snapshot ──────────┐   │
└───────────────────────────────────────────────────────────────┼───┘
                                                                │ HTTPS
                                                                ▼
                                          ┌──────────── Supabase ────────────┐
                                          │ Auth (email + Google)            │
                                          │ PostgreSQL                       │
                                          │   profiles                       │
                                          │   pennywise_user_data (JSONB)    │
                                          │ Row Level Security on all tables │
                                          └──────────────────────────────────┘
```

**Design principle:** the accounting rules live in one place (`store.js`) and the UI (`app.js`) never touches money logic. The cloud layer (`auth-boot.js`) wraps around them without changing either, so the original, tested store logic did not have to be rewritten to add cloud sync.

---

## 5. File Structure and Purpose of Each File

```
pennywise/
├── assets/
│   └── logo.png                Optional brand logo (falls back to a "P" mark)
├── css/
│   ├── auth.css                Styles for the login / sign-up page only
│   └── styles.css              Global design system and app layout
├── js/
│   ├── app.js                  UI layer: shell, pages, modals, forms
│   ├── auth-boot.js            Auth gate + cloud sync adapter for app pages
│   ├── auth.js                 Logic for auth.html (login, signup, Google)
│   ├── store.js                Data and accounting layer (window.PW)
│   ├── supabase-client.js      Creates the Supabase client
│   └── supabase-config.js      Public Supabase URL + anon key
├── sql/
│   ├── supabase-schema.sql     Bootstrap schema, RLS policies, triggers, snapshot RPC
│   └── sync_data.sql           Incremental concurrency upgrade for older installations
├── tests/
│   └── test_store.js           Unit tests for the accounting logic
├── .gitignore                  Files excluded from Git
├── accounts.html               Accounts page (shell)
├── auth.html                   Login / sign-up page
├── index.html                  Dashboard page (shell)
├── listapay.html               ListaPay page (shell)
├── README.md                   This document
├── server.js                   Local development server
└── transactions.html           Transactions page (shell)
```

### 5.1 HTML pages

| File | Purpose |
| --- | --- |
| `index.html` | **Dashboard.** `<body data-page="dashboard">`. Contains only an empty `<main id="page">`; `app.js` builds the sidebar, top bar, mobile nav, and dashboard content around it. |
| `transactions.html` | **Transactions.** `data-page="transactions"`. Add-transaction form plus searchable, filterable history. |
| `listapay.html` | **ListaPay.** `data-page="listapay"`. People, groups, and bills. Supports a deep link `listapay.html?open=<entryId>` that opens an entry's detail dialog (used by the "Open in ListaPay" button on linked transactions). |
| `accounts.html` | **Accounts.** `data-page="accounts"`. Account cards, total balance, add/edit/delete, and transfers. |
| `auth.html` | **Sign in / Create account.** A standalone page (no app shell) with a Log in ⇄ Create account tab switch and a Google button. Logged-in users are redirected to `index.html`. |

All four app pages share the same structure: a `pw-loading` class on `<html>` (CSS paints a green sidebar and white top bar placeholder to avoid a white flash), a `data-page` attribute that tells `app.js` which page to render, and the same script order — `supabase-config.js` → Supabase CDN → `supabase-client.js` → `auth-boot.js`. `store.js` and `app.js` are **not** in the HTML; `auth-boot.js` loads them only after the user is authenticated and their data is ready (they are preloaded with `<link rel="preload">` for speed).

### 5.2 JavaScript

| File | Purpose |
| --- | --- |
| `js/supabase-config.js` | Defines `window.PENNYWISE_SUPABASE_CONFIG` with the project **URL** and **anon (public) key**. Never put a `service_role` key here. |
| `js/supabase-client.js` | Validates the config and creates `window.pwSupabase` with persistent sessions and auto token refresh. Sets `window.pwSupabaseReady`. |
| `js/auth.js` | Drives `auth.html`: toggles login/signup mode, validates username (3–24 chars: letters, numbers, underscore) and password (≥ 8 chars), calls `signUp`, `signInWithPassword`, or `signInWithOAuth({provider:'google'})`, and shows errors. |
| `js/auth-boot.js` | **The gatekeeper and cloud adapter** for the four app pages. See [section 8](#8-authentication-and-cloud-sync-flow). Redirects unauthenticated visitors to `auth.html`, loads or migrates the user's cloud data into `localStorage`, loads `store.js`/`app.js`, then hooks `localStorage` writes to sync changes to Supabase. Also defines `window.pwSignOut()`. |
| `js/store.js` | **Data and accounting layer**, exposed as `window.PW` (and `module.exports` for tests). Handles schema migration, validation, derived balances, and all CRUD for accounts, transactions, debts, and payments. Contains no DOM code. |
| `js/app.js` | **UI layer.** Builds the app shell (sidebar, top bar, mobile nav, notifications, user menu), renders each page, and provides the modal, toast, and confirm-dialog systems. It only calls `PW.*` functions; it never computes money itself. |

### 5.3 CSS

| File | Purpose |
| --- | --- |
| `css/styles.css` | The design system: color tokens, typography, layout shell, cards, buttons, forms, tables, modals, toasts, donut chart, ListaPay and Accounts components, first-paint placeholder, and all responsive rules (tablet, phone, small-phone, collapsible sidebar). |
| `css/auth.css` | Styles specific to the login / sign-up page: two-column brand + card layout, tabs, notices, Google button. |

### 5.4 Server, database, and tests

| File | Purpose |
| --- | --- |
| `server.js` | A minimal Node static file server for development (default port 3000). Rejects path-traversal requests, maps MIME types, disables caching, and sets security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`). It is not used in production; Vercel serves the static files. |
| `sql/supabase-schema.sql` | Run once in the Supabase SQL Editor. Creates the tables, enables RLS, defines per-user policies, and configures conflict-safe snapshot saving. |
| `sql/sync_data.sql` | Incremental upgrade for an existing database created from the earlier schema: adds snapshot revisions and the guarded save RPC. The current bootstrap schema already includes these. |
| `tests/test_store.js` | 14 test cases covering migration, validation, balances, transfers, lending, repayments, group debts, bills, and account deletion. |
| `.gitignore` | Excludes `node_modules`. |

---

## 6. How the Accounting Works

The core rule: **balances are never stored. They are always derived.**

```
account balance = opening balance + effect of every transaction on that account
```

### Transaction types

| Type | Created by | Effect on account | Counts as income/expense? |
| --- | --- | --- | --- |
| `income` | Transactions page | + amount | Income |
| `expense` | Transactions page; bill payments | − amount | Expense |
| `transfer` | Transactions / Accounts page | − from source, + to destination | No |
| `lend` | ListaPay (money lent out) | − amount | No |
| `repay` | ListaPay (money received back) | + amount | No |

Lending and repayments are deliberately **not** income or expense, so monthly summaries and the budget reflect real spending only.

### Safety rules in `store.js`

- **Integer cents.** All arithmetic uses cents to avoid floating-point errors (`0.1 + 0.2` problems).

- **Validation.** Amounts must be > 0 and ≤ 1 trillion; dates must be real calendar dates (`2026-02-31` is rejected); accounts and categories must exist.

- **Duplicate guard.** An identical submission within 800 ms is rejected (double-click protection).

- **Linked records.** A transaction with a `link` belongs to a ListaPay entry. It cannot be edited on the Transactions page, and deleting it correctly reverses its effect on the debt. `syncLinked()` re-derives all linked transactions from the debt/payment records so they cannot drift.

- **No overpayment.** A payment cannot exceed the remaining balance (per member for group debts). A debt amount cannot be edited below what is already paid.

- **Account deletion.** An account with history requires a destination account; history and the opening balance are merged so the total balance is unchanged. The last account cannot be deleted.

- **Unreadable data is never destroyed.** If a `localStorage` list is corrupt, a copy is saved as `<key>_corrupt`.

- **Idempotent migration.** `migrate()` upgrades older data (schema v1 → v2) without deleting records.

### Browser storage keys

| Key | Contents |
| --- | --- |
| `financeApp_accounts` | `[{id, name, type, openingBalance}]` |
| `financeApp_transactions` | `[{id, type, amount, category, date, description, accountId, toAccountId?, link?, createdAt}]` |
| `financeApp_listapay` | `[{id, kind, direction, name, amount, dueDate, date, note, members?, accountId, lendTxId}]` where `kind` is `person`, `group`, or `bill` |
| `financeApp_payments` | `[{id, debtId, memberId?, amount, date, accountId, txId, note}]` |
| `financeApp_monthlyBudget`, `financeApp_userName`, `financeApp_schema` | Budget, display name, schema version |

Categories: Food, Transport, Bills, Entertainment, Essential Expenses, Financial, Education, Family Social, Salary, Others (plus system categories Transfer, Loan Given, Loan Repayment).

---

## 7. Database Design (Supabase)

Defined in `sql/supabase-schema.sql`.

### Tables

**`public.profiles`** — one row per user

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | `uuid` PK | References `auth.users(id)`, cascades on delete |
| `username` | `text` | **Unique**, must match `^[a-z0-9_]{3,24}$` |
| `created_at` | `timestamptz` | Defaults to `now()` |

**`public.pennywise_user_data`** — one row per user

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | `uuid` PK | References `auth.users(id)`, cascades on delete |
| `payload` | `jsonb` | The user's complete finance snapshot (all `financeApp_*` keys). Must be a JSON object. |
| `revision` | `bigint` | Incremented for every accepted snapshot save; used to reject stale-device writes. |
| `updated_at` | `timestamptz` | Set by a server-side trigger, not the browser |

> **Design note:** The finance data is stored as one JSONB snapshot per user. This preserved the existing, tested synchronous `store.js` logic during the move to the cloud. A normalized multi-table schema (accounts, transactions, debts, payments) is listed under [Future Work](#15-known-limitations-and-future-work).

### Row Level Security

RLS is enabled on both tables. Every policy restricts access to `auth.uid() = user_id`:

| Table | Operations allowed (authenticated users, own rows only) |
| --- | --- |
| `profiles` | SELECT, UPDATE |
| `pennywise_user_data` | SELECT, INSERT, UPDATE, DELETE |

The `anon` role has **all privileges revoked** on both tables.

### Triggers and functions

- **`handle_new_pennywise_user()`** (`SECURITY DEFINER`, empty `search_path`) runs after every insert on `auth.users`. It creates the profile row. An explicit signup username must be unique; Google users get a safe generated handle (email prefix + random suffix).

- **`set_pennywise_updated_at()`** sets `updated_at = now()` before every update of `pennywise_user_data`.

- **`save_pennywise_snapshot()`** is a `SECURITY INVOKER` RPC. It saves only when the supplied revision matches the latest row revision, otherwise returns the newer snapshot as a conflict. Only authenticated users can execute it; trigger functions are not callable through the API.

### CRUD mapping

| Operation | How it reaches the database |
| --- | --- |
| **Create** | Adding an account/transaction/debt/payment updates `localStorage`; the sync adapter calls `save_pennywise_snapshot()` to create the first snapshot. |
| **Read** | On login, the snapshot is `SELECT`ed and loaded into the working cache. |
| **Update** | Edits change the cached lists, then a revision-checked save updates the snapshot (`updated_at` remains server-generated). |
| **Delete** | Deletions remove items from the cached lists and use the same revision-checked save. Account deletion cascades from `auth.users`. |

---

## 8. Authentication and Cloud Sync Flow

### Sign-up / login (`auth.html` + `auth.js`)

1. User picks **Log in** or **Create account** (a username is required for sign-up).

1. Email/password goes to Supabase Auth; or the user clicks **Continue with Google** (OAuth redirect).

1. On sign-up, the database trigger creates the matching `profiles` row.

1. On success the user is redirected to `index.html`.

### Booting an app page (`auth-boot.js`)

1. **Gate:** no session → redirect to `auth.html`.

1. **First load for this user on this browser:** fetch the cloud snapshot.
  - Cloud data exists and this browser also has data → the user chooses *migrate this browser's data to the cloud* or *keep cloud data*. A **local backup is saved first** in either case.
  - Only cloud data exists → restore it into the browser.
  - No cloud data → import existing local data (with confirmation) or start fresh and create the cloud row.

1. **Later page loads:** compare the cached revision with the cloud revision. A newer cloud copy restores automatically only when this browser has no unsynced work; otherwise the user chooses which copy to keep and the other is backed up locally.

1. Restore the page, load `store.js` and `app.js`, trigger rendering, and remove the loading placeholder.

1. **Install the sync hook:** writes to any `financeApp_*` key mark data as *dirty* and, after a 650 ms debounce, save the snapshot with its expected revision. Sync is also attempted when the browser comes back online, when the tab is hidden, and before the page unloads. A stale save never overwrites cloud data: the user can restore the cloud copy or retain a local backup.

### Sign out (`window.pwSignOut`)

1. Try to sync the latest changes. If that fails, ask the user whether to sign out anyway.

1. Block any further uploads, save a local backup, clear the local cache, and sign out of Supabase.

1. Redirect to `auth.html`. The next login reloads data from the cloud, so one account's data never appears in another account's session.

---

## 9. Security

- **Row-level security** on every table; each user can only read or write their own rows. Anonymous access is revoked.

- **Public anon key only** in the browser. The `service_role` key must never be committed or used client-side.

- **Passwords** are hashed and managed by Supabase Auth; the app never stores them.

- **XSS protection:** all user-provided text is HTML-escaped before rendering (`esc()` in `app.js`); avatar URLs are limited to `https://`.

- **Input validation** on both username format (UI + database constraint) and all financial inputs (`store.js`).

- **Dev server hardening:** path-traversal guard, `nosniff`, restrictive `Permissions-Policy`.

- **Session handling:** persistent sessions with automatic token refresh via supabase-js.

---

## 10. Run Locally

**Prerequisites:** Node.js 16+ and a free [Supabase](https://supabase.com) project (see [deployment step 1](#12-deployment-steps)).

```bash
# 1. Clone the project repository
git clone https://github.com/brieninocencio/PennyWise--Personal-Money-Tracker-App.git
cd PennyWise--Personal-Money-Tracker-App

# 2. Add your Supabase URL and anon key
#    edit js/supabase-config.js

# 3. Start the dev server
node server.js
# → http://localhost:3000/
```

Open `http://localhost:3000/`; you will be redirected to the sign-in page. For Google sign-in to work locally, add `http://localhost:3000/` to your Supabase **Auth → URL Configuration → Redirect URLs**.

---

## 11. Testing

The accounting layer is tested in plain Node with a mocked `localStorage`:

```bash
node tests/test_store.js
```

Expected output: 14 `PASS` lines and `14 passed`. Tests cover legacy-data migration, corrupt-storage safety, income/expense/transfer effects, input validation, duplicate-submit protection, update/delete recalculation, lending and partial/full repayment, loan edits, payment edits and deletes, group debts, bill payments, and account merge/deletion without creating or destroying money.

---

## 12. Deployment Steps

### Step 1 — Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).

1. Open **SQL Editor**, paste the contents of `sql/supabase-schema.sql`, and run it as the project owner.
  - For an existing installation created from the older PennyWise schema that does not yet have the `revision` column and `save_pennywise_snapshot()` function, run `sql/sync_data.sql` after the original schema. Do not run it as a replacement for the bootstrap schema on a new project; the current `sql/supabase-schema.sql` already includes the concurrency support.

1. Go to **Project Settings → API** and copy the **Project URL** and the **anon / publishable key**.

1. Paste them into `js/supabase-config.js`.

### Step 2 — Configure Authentication

1. **Auth → Providers → Email:** enabled. Decide whether to require email confirmation.

1. **Auth → Providers → Google:** create OAuth credentials in Google Cloud Console (Web application) and paste the Client ID and Secret into Supabase. Add Supabase's callback URL (shown on the provider page) as an **Authorized redirect URI** in Google Cloud.

1. **Auth → URL Configuration:**
  - **Site URL:** `https://pennywise-pm.vercel.app/` for the current deployment.
  - **Redirect URLs:** allow the live URL and `http://localhost:3000/` for local work. Add any additional Vercel preview URLs only if you use them.

### Step 3 — Use the GitHub repository

```bash
# Clone if you do not already have a local copy
git clone https://github.com/brieninocencio/PennyWise--Personal-Money-Tracker-App.git
cd PennyWise--Personal-Money-Tracker-App
```

If you already have a project checkout, keep its existing Git history and `origin` remote; do not run `git init` or replace the remote. Push reviewed changes to the repository and merge them into the configured production branch before expecting a production deployment.

### Step 4 — Deploy on Vercel

1. In [Vercel](https://vercel.com): **Add New → Project**, import `brieninocencio/PennyWise--Personal-Money-Tracker-App` from GitHub, and select the repository.

1. Use the **Other** framework preset. This is a static site: leave the build command empty and set the output directory to the repository root (`.`) if Vercel asks for one.

1. Deploy the project. Check the Vercel project settings to confirm which branch is configured for production; preview and production deployments may use different branches.

1. The current production URL is `https://pennywise-pm.vercel.app/`. If Vercel assigns a different production URL or you add a custom domain, update the Supabase **Site URL**, its **Redirect URLs**, and the live URL at the top of this README.

### Step 5 — Verify before release

The checked items below were verified against the supplied project snapshot or for basic live-site reachability on **2 November 2026**. They do not prove that the checked-out snapshot is the version currently deployed. Complete the remaining checks against the production site before claiming end-to-end functionality; mark an item complete only after testing it.

- [ ] Run `node tests/test_store.js`; the supplied snapshot reports **14 passed**.

- [ ] Run `node --check` on the JavaScript source, test, and server files; syntax checks pass in the supplied snapshot.

- [ ] Confirm the live root URL responds and serves the PennyWise page. This confirms reachability only, not sign-in or database operation.

- [ ] Create an email account, sign in, sign out, and sign back in on the deployed site.

- [ ] Test Google sign-in if the Google provider is enabled and configured.

- [ ] Create, edit, and delete a transaction, an account, and a ListaPay entry; reload and confirm the changes persist.

- [ ] Record a partial payment and confirm the outstanding amount and account balance are correct after reload.

- [ ] Sign in from a second browser/device and confirm the same user data appears; exercise a stale-revision conflict if possible.

- [ ] Confirm user isolation with two test accounts: each account must be unable to read or change the other account's data.

- [ ] In Supabase **Table Editor → ****`pennywise_user_data`**, confirm the signed-in user's snapshot and revision update after changes.

- [ ] Check navigation, forms, dialogs, and readable layout at phone viewport sizes.

- [ ] Record the Git commit SHA used for the production deployment and confirm it matches the intended release commit.

---

## 13. Development Workflow (Git)

- `main` should hold the deployable version; Vercel production deployments use the branch configured in the Vercel project settings.

- Work happens on short-lived **feature branches** (for example `feature/accounts-page`, `feature/supabase-auth`, `fix/signout-data-loss`, `fix/page-flash`) and is merged into `main` through **pull requests**.

- Commit messages follow a simple convention:

| Prefix | Use for |
| --- | --- |
| `feat:` | A new feature |
| `fix:` | A bug fix |
| `style:` | UI/CSS changes |
| `refactor:` | Code restructuring without behavior change |
| `test:` | Adding or updating tests |
| `docs:` | README and documentation |
| `chore:` | Setup and configuration |

---

## 14. Requirement Mapping

| # | Course requirement | Where it is satisfied |
| --- | --- | --- |
| 1 | Full-stack application (frontend + backend) | Frontend: HTML/CSS/JS pages. Backend services: Supabase PostgreSQL, Auth, and RLS. `server.js` is a local development static-file server, not the production backend. |
| 2 | Database with working CRUD | Supabase stores a per-user JSONB snapshot in `pennywise_user_data`; the app implements CRUD for accounts, transactions, debts, and payments ([section 7](#7-database-design-supabase)). Verify the deployed cloud flow using the checklist in section 12. |
| 3 | GitHub repository with complete source | This repository. |
| 4 | Commit history showing the development process | See the repository's commit log. |
| 5 | At least one branch created and merged into main | Check the GitHub branch/commit history and link the completed merge pull request here when available. The supplied local history contains `backup-before-reorganize` at `c7387c0` in the `main` ancestry, but does not include a merge commit or pull-request record. |
| 6 | Deployed with a live URL | Vercel deployment: [https://pennywise-pm.vercel.app/](https://pennywise-pm.vercel.app/). Complete the end-to-end checks in section 12 to verify deployed functionality. |
| 7 | README with description, tech stack, deployment steps | Sections 1, 3, and 12. |

---

## 15. Known Limitations and Future Work

**Current limitations**

- Finance data is stored as **one JSONB snapshot per user**. Revision checks prevent silent overwrites, but conflicts still need an explicit user choice instead of field-by-field merging.

- Sync-on-close relies on the browser finishing an async upload during page unload, which is not guaranteed in every browser.

- Money is shown in Philippine pesos (₱) only; there is no multi-currency support.

- There is no data export or import UI yet.

**Planned improvements**

- Normalize the database into `accounts`, `transactions`, `debts`, and `payments` tables with RLS, enabling per-record CRUD, conflict-free multi-device use, and SQL reporting.

- Add a small serverless API layer for exports (CSV/PDF) and monthly summaries.

- Recurring transactions and bill reminders by email or push notification.

- Charts for monthly trends and savings goals.

- Installable PWA with offline mode.

---

## Author

**Brien Inocencio** — Computer Engineering, President Ramon Magsaysay State University, College of Engineering.
Subject: Elec 3 – Technical Elective III (Software Development), Instructor: Ben Gerard R. Rosete.

