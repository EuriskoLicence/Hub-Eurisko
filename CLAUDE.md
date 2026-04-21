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

Key sections: `TIMESHEET`, `TIMESHEET_EXTRA`, `EXPENSES`, `FINANCE_DASHBOARD`, `FINANCE_EXPORT`, `FINANCE_AMENDMENT`, `PARAM_USERS`, `PARAM_ROLES`, `PARAM_ABSENCES`, `PARAM_EXPENSE_CAT`, `CLIENTS_MANAGE`.

### Route layout
```
src/app/
  (auth)/               # Public: login, change-password
  (dashboard)/          # Protected, requires session
    timesheet/          # Monthly timesheet grid + year overview
    timesheet-extra/    # Extra hours (same structure)
    expenses/           # Expense reports (year grid + monthly detail)
    clients/            # Clients, projects, engagements, reports
    finance/            # HR Finance: amendments, exports, user views
    admin/              # Parametric tables: users, roles, absences, categories...
  api/
    attachments/[...key]/ # Proxy GET/DELETE to R2 (auth-gated)
    upload/presigned-url/ # Issues R2 presigned PUT URL
    export/me/            # User's own exports (CSV + PDF)
    finance/export/       # Finance-level exports (CSV + PDF)
    finance/remind/       # Send reminder emails via Resend
```

### Database schema (main tables)
- **Authorization**: `sections`, `profiles`, `profile_sections`, `roles`, `role_profiles`, `users`
- **Hierarchy**: `clients` → `projects` → `engagements` → `engagement_users`
- **Timesheet**: `absence_types` (shortCode 2-char unique), `timesheet_entries`, `timesheet_months`
- **Extra hours**: `timesheet_extra_entries`, `timesheet_extra_months`
- **Expenses**: `expense_categories`, `vehicle_types`, `expense_reports`, `expense_lines`
- **Calendar**: `italian_holidays`

Status enum (shared by timesheet and expenses): `draft | approved | amendment_requested | amendment_rejected`

### Expense attachments (R2)
File path in bucket: `expenses/{userId}/{year}/{month}/{uuid}.{ext}` — year/month come from the **expense report** period, not the current date (important: always pass `year` and `month` from the client).

Flow: browser → `POST /api/upload/presigned-url` (returns presigned PUT URL) → browser uploads directly to R2 → `onUploaded(key, filename)` callback → auto-save draft.

On removal: `DELETE /api/attachments/{key}` → R2 delete → `onRemoved()` → auto-save draft.

Feature flag: `ATTACHMENTS_ENABLED` in `src/lib/features.ts`. Images are compressed client-side via `browser-image-compression` (max 1MB / 1920px) before upload.

### Email (Resend)
`src/lib/email.ts` — lazy initialization (`getResend()`) to avoid build-time errors when `RESEND_API_KEY` is absent. Called fire-and-forget (no `await`) from server actions.

### Key client components
- `MonthGrid` / `ExtraMonthGrid` — timesheet data entry grids (desktop table + mobile cards)
- `ExpenseGrid` — expense data entry with per-cell attachments
- `AttachmentButton` — upload/view/remove single attachment, receives `year` + `month` props

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

## Git / Deploy
- Repo: `github.com/EuriskoLicence/Hub-Eurisko` (public, main branch)
- Vercel auto-deploys on push to `main`
- Always `git push origin main` after committing — commits without push don't trigger deploy
