# PennyWise — Supabase authentication and cloud sync (incremental MVP)

This version preserves the existing PennyWise HTML/CSS/JavaScript UI and its `store.js` financial calculations. It adds:

- Email + password registration with a unique username (the email can be from any provider; it does not need to be Gmail).
- Email/password login and optional Google OAuth.
- Per-user cloud persistence through Supabase and row-level security (RLS).
- A one-time, explicit localStorage migration decision, with a local backup before replacing/restoring data.
- A small cloud-sync status indicator and Sign out control.

## Important architecture note

The original `store.js` API is synchronous and used throughout the UI. To avoid rewriting and risking the existing CRUD/balance logic in one step, this MVP keeps localStorage as a working cache for the active signed-in user and synchronizes all `financeApp_*` values as one JSONB snapshot in `public.pennywise_user_data`. Supabase RLS restricts each row to its owner. This is a practical incremental bridge, not the final normalized relational schema for a larger production finance service. It also means simultaneous edits from multiple devices can overwrite each other; use one active editing device during this MVP. A later phase should move each CRUD operation to relational tables and server-side database transactions/RPCs.

## 1. Open the project in VS Code

1. Extract the project folder.
2. Open the folder in VS Code.
3. Use a local web server; do not open `index.html` as a `file://` URL. The included `server.js` serves the files at `http://localhost:3000`.
4. Run `node server.js`, then visit `http://localhost:3000/auth.html`.

Node.js is only used to serve static files. Supabase is the hosted authentication and data backend.

## 2. Create and configure Supabase

1. Create a Supabase project.
username - Pennywise
password - pennywise-supabase
2. Open **SQL Editor** and run all of `supabase-schema.sql`.
3. Open **Project Settings → API** (the exact menu label may vary) and copy the Project URL and the publishable key (or legacy `anon` key).
4. Paste them into `supabase-config.js`:

```js
window.PENNYWISE_SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  anonKey: 'YOUR_PUBLISHABLE_OR_ANON_KEY'
};
```

Only the public publishable/anon key belongs in browser code. **Never use the `service_role` key in this project or commit it to Git.** The browser key is safe to expose only because RLS is enabled and the policies in the SQL file restrict access to `auth.uid()`.

## 3. Configure email/password authentication

1. In Supabase, open **Authentication → Providers → Email** and enable email/password sign-in.
2. Decide whether to require email confirmation. If confirmation is enabled, the user must click the email link before logging in. For a deployed app, keep confirmation enabled.
3. In **Authentication → URL Configuration**, set the Site URL to your deployed HTTPS URL. Add these redirect URLs for development and deployment:
   - `http://localhost:3000/index.html`
   - Your deployed dashboard URL, for example `https://your-domain.example/index.html`
4. Registration asks for username, email and password. Username is 3–24 lowercase letters, digits or underscores. Password minimum is 8 characters. Supabase manages password hashing and sessions; PennyWise does not store passwords in localStorage or in its finance-data table.

## 4. Configure optional Google login

1. In Google Cloud Console, create/select a project and configure the OAuth consent screen.
2. Create an OAuth client ID for a **Web application**.
3. Copy the Supabase Google provider callback URL shown in **Supabase → Authentication → Providers → Google** into Google Cloud's **Authorized redirect URIs**. Use the exact callback URL Supabase shows; do not guess it.
4. Add the Google client ID and client secret to the Supabase Google provider settings. The secret belongs in Supabase only, never in this repository.
5. Ensure the PennyWise dashboard URLs above are allowed in Supabase Auth URL Configuration.
6. Test Google sign-in on localhost, then again on the deployed HTTPS domain.

## 5. How local data migration works

On first login, PennyWise checks the signed-in user's cloud row before starting the old app:

- If the cloud row is empty and local finance data exists, a confirmation asks whether to import it.
- If cloud data already exists and local finance data exists, a confirmation asks whether to replace the cloud dataset with the local dataset or restore cloud data. Choose carefully.
- A local JSON backup named `pennywise_backup_<user-id>_<timestamp>` is created before the migration decision.
- If local data is declined for import, the old `financeApp_*` data is cleared from the working cache before the signed-in user's data is initialized.
- Sign out syncs changes first and saves a local backup before clearing the active finance cache.

For safety, test with a copy of your browser data first. Do not use the cloud-overwrite option unless you are sure the local data is the copy you want to keep.

## 6. Test the app before deployment

From this folder run:

```bash
node test_store.js
node --check auth.js
node --check auth-boot.js
node --check app.js
node --check store.js
```

`test_store.js` checks the existing accounting layer, including transfers, CRUD, loan repayments, group payments, and balance synchronization. It does not test a live Supabase project. Also complete the manual integration checks below:

- Register a new email/password user and confirm username uniqueness.
- Log in, add/edit/delete an account and income/expense/transfer transaction, and confirm dashboard/transaction/account balances agree.
- Add a ListaPay person, group and bill; record/edit/delete payments; verify linked transactions and balances remain correct.
- Reload the page and sign in from another browser; confirm the same cloud data appears.
- Create a second test user; verify that user cannot read or change the first user's cloud row.
- Test Google login and logout.
- Simulate offline mode, reconnect and confirm the sync status recovers.
- Try a migration with a known backup and compare total balance, account count, transaction count, ListaPay count and payment count before/after.

## Security and limitations to address before public launch

- Do not deploy until the project URL/key are configured, the SQL schema has been applied, email/Google redirect URLs are correct, and RLS has been tested with two separate users.
- Serve the deployed app over HTTPS.
- This snapshot adapter debounces saves and does not provide cross-device conflict resolution or atomic multi-user financial operations. Avoid simultaneous editing on multiple devices in this MVP.
- Browser localStorage is a cache, not an encrypted vault. Sign out clears the active finance cache after backup/sync, but users should not use shared/public devices for sensitive finances.
- If this grows beyond an MVP, migrate to normalized `accounts`, `transactions`, `listapay_entries`, `listapay_members`, `payments`, and `budgets` tables with `user_id` on every table, RLS on each table, and database transactions/RPCs for multi-record operations.
