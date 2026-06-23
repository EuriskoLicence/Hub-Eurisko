# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build (runs type-check + lint)
npm run lint         # ESLint
npm run test         # Run tests (Vitest)
npm run test:watch   # Watch mode

# Database
npm run db:generate  # Generate migration from schema changes
npm run db:migrate   # Apply migrations
npm run db:studio    # Drizzle Studio (DB browser)

# Seed (requires .env.local loaded)
node --env-file=.env.local -e "require('tsx/cjs'); require('./src/db/seed.ts')"
```

## Stack

- **Next.js 14.2.3** App Router, server components + server actions
- **NextAuth v5 beta** — JWT sessions (8h), credentials provider
- **Drizzle ORM** + **Neon PostgreSQL** (serverless)
- **Tailwind CSS** + Radix UI + Lucide icons
- **Cloudflare R2** (S3-compatible) for expense attachments
- **Resend** for transactional emails
- **pdf-lib / xlsx-js-style** for PDF/Excel exports

## Architecture

### Auth split (Edge Runtime constraint)
Middleware runs on the Edge runtime and cannot import Node.js-only modules (`bcryptjs`, DB).

- **`src/auth.config.ts`** — Edge-safe: JWT callbacks, session shape, pages config. No DB, no bcrypt.
- **`src/auth.ts`** — Node.js only: extends authConfig, adds Credentials provider (bcryptjs + DB).
- **`src/middleware.ts`** — Imports only `authConfig`. Handles: unauthenticated → `/login`, `mustChangePassword` → `/change-password`.

### Permissions model
Sections (hardcoded in `src/lib/permissions/sections.ts`) → Profiles (group of sections) → Roles (group of profiles) → Users.

Session JWT carries `sections: SectionCode[]`. All server actions call `requireSection(session, 'SECTION_CODE')` before doing anything.

Key sections: `TIMESHEET`, `TIMESHEET_EXTRA`, `EXPENSES`, `FINANCE_DASHBOARD`, `FINANCE_EXPORT`, `FINANCE_AMENDMENT`, `PARAM_USERS`, `PARAM_ROLES`, `PARAM_ABSENCES`, `PARAM_EXPENSE_CAT`, `PARAM_ENGAGEMENTS`, `PARAM_ENGAGEMENT_STATUSES`, `PARAM_PO_LINE_STATUSES`, `PARAM_HOLIDAYS`, `CLIENTS_VIEW`, `CLIENTS_MANAGE`, `PURCHASE_ORDERS_VIEW`, `PURCHASE_ORDERS_MANAGE`, `INVOICES_VIEW`, `INVOICES_MANAGE`.

### Route layout
```
src/app/
  (auth)/               # Public: login, change-password
  (dashboard)/          # Protected, requires session
    timesheet/          # Monthly timesheet grid + year overview
    timesheet-extra/    # Extra hours, compiled by project responsible on behalf of user
    expenses/           # Expense reports (year grid + monthly detail)
    clients/            # Clients, projects, engagements, reports
      orders/           # Purchase Orders (OdA): list + new + [id] detail
      invoices/         # Invoicing (fatture/note credito): list + new + [id] detail
      reports/          # Hours per engagement, engagement list, users-per-engagement,
                        # OdA list, OdA per engagement
    finance/            # HR Finance: amendments, exports, user views
    admin/              # Parametric tables: users, roles, absences, expense-categories,
                        # engagement-types, engagement-statuses, po-line-statuses, holidays
  api/
    attachments/[...key]/ # Proxy GET/DELETE to R2 (auth-gated, kind-branched ACL)
    upload/presigned-url/ # Issues R2 presigned PUT URL (kind: expense | purchase-order | invoice)
    export/me/            # User's own exports (CSV + PDF)
    finance/export/       # Finance-level exports (CSV + PDF, excludes partTimeOnly absences)
    finance/remind/       # Send reminder emails via Resend
```

### Database schema (main tables)
- **Authorization**: `sections`, `profiles`, `profile_sections`, `roles`, `role_profiles`, `users`
- **Hierarchy**: `clients` → `projects` → `engagements` → `engagement_users`
- **Timesheet**: `absence_types` (shortCode 2-char unique, `part_time_only` flag), `timesheet_entries`, `timesheet_months`
- **Extra hours**: `timesheet_extra_entries`, `timesheet_extra_months`
- **Expenses**: `expense_categories`, `vehicle_types`, `expense_reports`, `expense_lines`
- **Calendar**: `italian_holidays`
- **Purchase Orders (OdA)**:
  - `purchase_orders` — testata (code 6-digit via PG sequence `purchase_orders_code_seq`,
    external number, clientId, `billing_client_id` (nullable FK clients — "cliente
    fatturazione", set at creation, not editable), totalAmount, responsibleUserId,
    `needs_review` flag)
  - `purchase_order_attachments` — at least 1 mandatory; R2 path under `purchase-orders/`
  - `purchase_order_lines` — positions (code 3-digit per OdA, engagementId, amount;
    sum must equal totalAmount on save, epsilon 0.01)
  - `engagement_statuses` — parametric, optional status on engagements (code 3-char alphanum + description)
  - `purchase_order_line_statuses` — parametric, optional status on positions (code 3-char alphanum)
- **Invoicing (Fatturazione)**:
  - `invoices` — header (clientId, documentDate, documentNumber manual, `invoice_type`
    enum invoice|credit_note, currency, totalAmount, vatAmount, headerText)
  - `invoice_attachments` — optional, N per document; R2 path under `invoices/`
  - `invoice_lines` — positions (lineNumber progressive per invoice server-side,
    `is_oda_related` default TRUE, `is_travel_reimbursement` default false,
    optional FK to `purchase_order_lines`; balance rule: sum(amount) must equal
    totalAmount − vatAmount, epsilon 0.01)

- **Flags added to existing tables**:
  - `engagement_types.no_oda` — when true, engagements of this type are excluded
    from OdA position dropdown and from the "OdA per commessa" report
  - `engagements.conclusa` (bool) + `engagements.status_id` (FK engagement_statuses)
  - `engagement_users.extra_only` — when true, the engagement is selectable for that
    user ONLY in the extra timesheet, NOT in the ordinary one

Status enum (shared by timesheet and expenses): `draft | approved | amendment_requested | amendment_rejected`

### Attachments (R2)
Path keys in bucket:
- Expenses: `expenses/{userId}/{year}/{month}/{uuid}.{ext}` — year/month come from the **expense report** period, not the current date (important: always pass `year` and `month` from the client).
- Purchase Orders: `purchase-orders/{purchaseOrderId}/{uuid}.{ext}` — the OdA id is pre-generated client-side so the R2 path matches the future PO id.
- Invoices: `invoices/{invoiceId}/{uuid}.{ext}` — same client-pregenerated-id pattern as OdA.

`POST /api/upload/presigned-url` accepts a discriminated union on `kind` (`'expense'` default for backward compatibility, `'purchase-order'` for OdA, `'invoice'` for Fatturazione). Browser uploads directly to R2 with the presigned PUT URL.

`GET/DELETE /api/attachments/[...key]` has ACL branched by path prefix:
- `expenses/...` → owner OR finance roles can GET; only owner can DELETE
- `purchase-orders/...` → `PURCHASE_ORDERS_VIEW` or `MANAGE` can GET; only `MANAGE` can DELETE
- `invoices/...` → `INVOICES_VIEW` or `MANAGE` can GET; only `MANAGE` can DELETE

Feature flag: `ATTACHMENTS_ENABLED` in `src/lib/features.ts`. Images are compressed client-side via `browser-image-compression` (max 1MB / 1920px) before upload.

### Purchase Orders (OdA)
Flow: header → at least 1 attachment → positions whose sum must equal `totalAmount`.

- **Header code**: 6-digit global progressive, generated by PostgreSQL sequence `purchase_orders_code_seq` (created idempotently by migration 0008). Helper: `generatePurchaseOrderCode()` in `src/app/(dashboard)/clients/orders/actions.ts`.
- **Position code**: 3-digit progressive per OdA, computed server-side at save (`MAX(code)+1` per `purchaseOrderId`).
- **`needs_review`** is set to `true` when a `CLIENTS_MANAGE` user changes `totalAmount` on an OdA that already has positions which no longer sum to the new total. It auto-clears when positions are saved with `sum == totalAmount`.
- **Engagement selectability for positions**: only those of the header's client where `projects.active=true`, `engagements.conclusa=false`, `engagement_types.no_oda=false`, `engagements.valid_until >= today`.
- **Billing client (`billing_client_id`)**: mandatory at OdA creation (app-level, via `CreateOdaSchema`), nullable in DB to allow manual backfill of historical OdA on Neon, not editable after creation. Drives the OdA-line matching in invoices.
- **Deletion**: only allowed when no positions exist; cascades attachments and best-effort cleans up R2.
- **Emails** (`src/lib/email.ts`):
  - `sendPurchaseOrderAssignedEmail` — on creation and on responsible change
  - `sendPurchaseOrderTotalChangedEmail` — on totalAmount change with existing positions
  - `sendPurchaseOrderReminderEmail` — on reminder banner (multi-select responsibles), HTML table of pending OdA per recipient

### Invoicing (Fatturazione)
Records invoices and credit notes issued to clients, with positions matchable to OdA positions. Actions in `src/app/(dashboard)/clients/invoices/actions.ts`.

- **Header**: client (labelled "Cliente fatturazione" in the UI — `invoices.clientId` is the billing client), documentDate, documentNumber (manual, no sequence), type (Fattura/Nota credito — credit notes have NO reference-to-invoice field by explicit decision), currency (EUR/USD/GBP/CHF select), totalAmount, vatAmount (0 allowed = esente), headerText, optional N attachments.
- **Single balance rule** (enforced in `saveInvoiceLines`, blocking): `sum(lines.amount) == totalAmount − vatAmount` (epsilon 0.01). Implicit list states: "Senza posizioni" / "Da quadrare" / "Quadrata" (`isBalanced` computed in `getInvoices`).
- **Positions** (`invoice_lines`): lineNumber assigned server-side (progressive from max remaining, replace strategy like OdA); `is_oda_related` checkbox **defaults to CHECKED** on new rows — when checked, an OdA-position match (`purchaseOrderLineId`) is mandatory and must belong to a PO of the invoice's client; unchecking clears the match. `is_travel_reimbursement` checkbox defaults unchecked.
- **OdA line options**: `getOdaLinesForClient(billingClientId)` matches the OdA's `billing_client_id` against the invoice's billing client (`invoices.clientId`) AND is a WHITELIST on status code `'AUT'` or `'PAR'` (lines with no status or any other status, e.g. `'INV'`, are excluded). Historical OdA whose `billing_client_id` is still NULL won't match until backfilled. Lines already matched by the current invoice but no longer selectable are still shown via `getReferencedUnselectableOdaLines` (label suffixed with their status code, option disabled). Additional filters (e.g. residual amount to invoice) intentionally deferred.
- **Edit/delete always allowed** (explicit boss decision): `deleteInvoice` works even with positions (DB cascade + best-effort R2 cleanup, window.confirm in UI); header edit prompts confirm when totals change and lines exist; client change blocked only while lines exist.
- No emails, no reports yet (deferred backlog: OdA-line filters, invoicing reports).

### Engagement extra-only flag
`engagement_users.extra_only` (default `false`) lets the project responsible mark an assignment so the user sees that engagement only in `/timesheet-extra`, not in `/timesheet`. Toggled inline from `EngagementCard.tsx` via `setEngagementUserExtraOnly`. The ordinary timesheet query filters `extra_only = false`, but `saveTimesheetEntries` adds back engagements already referenced by existing entries of the same `(user, year, month)` so historical rows on engagements later flagged extra-only can still be edited/deleted.

### Email (Resend)
`src/lib/email.ts` — lazy initialization (`getResend()`) to avoid build-time errors when `RESEND_API_KEY` is absent. Called fire-and-forget (no `await`) from server actions.

### Key client components
- `MonthGrid` / `ExtraMonthGrid` — timesheet data entry grids (desktop table + mobile cards); both show per-row monthly total ("Totale" column on desktop, collapsible "Riepilogo per riga" card on mobile)
- `ExpenseGrid` — expense data entry with per-cell attachments; mobile card header shows category + engagement name
- `AttachmentButton` — upload/view/remove single attachment (expenses), receives `year` + `month` props
- `OrderAttachmentsList` — generic N-attachment uploader with `kind` prop ('purchase-order' default | 'invoice'); `OrderAttachmentsManager` (OdA) and `InvoiceAttachmentsManager` wrap it with the respective server actions
- `OrderHeaderEdit` / `InvoiceHeaderEdit` — header edit forms, prompt confirm when changing totals with positions; InvoiceHeaderEdit also exposes always-available delete
- `OrderLinesGrid` / `InvoiceLinesGrid` — editable positions tables (desktop) + mobile cards with live balance badge (OdA: sum vs total; invoices: sum vs total − VAT)
- `OdaReminderBanner` — amber banner at top of OdA list with multi-select responsibles modal
- `EngagementCard` — assigned-user rows expose toggle "Solo extra" (engagement_users.extra_only)

## Environment Variables

```bash
DATABASE_URL           # Neon PostgreSQL connection string
NEXTAUTH_SECRET        # Random secret (openssl rand -base64 32)
NEXTAUTH_URL           # App URL (e.g. https://hub.euriskosrl.it)
NEXT_PUBLIC_APP_URL    # Same as above (client-visible)
R2_ACCOUNT_ID          # Cloudflare account ID
R2_ACCESS_KEY_ID       # R2 API token key
R2_SECRET_ACCESS_KEY   # R2 API token secret
R2_BUCKET_NAME         # R2 bucket name
RESEND_API_KEY         # Resend API key
RESEND_FROM            # Sender address
HR_FINANCE_EMAIL       # Finance team email for notifications
ADMIN_EMAIL            # Default admin email (seed only)
ADMIN_PASSWORD         # Default admin password (seed only)
```

## iOS Mobile Notes
All `<input>` and `<select>` elements in mobile views must have `font-size` ≥ 16px (`text-base` in Tailwind) to prevent iOS Safari auto-zoom on focus. Use `text-base md:text-sm` pattern for inputs that appear in both mobile and desktop layouts.

## Password rules
Centralized in `src/lib/password-rules.ts` — exports `validatePassword(pwd)` returning an Italian error message or `null`, and constant `PASSWORD_HINT`. Rules enforced (min 12 chars, at least one uppercase, one digit, one special char from `!@#$%&*?-_`) are checked in:
- `/change-password` server action + client validation (forced first-login change)
- `/account/password` server action + client validation (self-service)
- Admin `updateUser` (password reset/edit by admin)

## Git / Deploy
- Repo: `github.com/EuriskoLicence/Hub-Eurisko` (public, main branch)
- Vercel auto-deploys on push to `main`
- Always `git push origin main` after committing — commits without push don't trigger deploy
