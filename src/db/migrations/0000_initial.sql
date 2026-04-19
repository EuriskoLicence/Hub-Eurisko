-- ============================================================
-- Migration 0000 — Schema iniziale HR Portal
-- Generata manualmente da src/db/schema.ts
-- ============================================================

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "timesheet_status" AS ENUM (
  'draft',
  'approved',
  'amendment_requested',
  'amendment_rejected'
);

CREATE TYPE "expense_status" AS ENUM (
  'draft',
  'approved',
  'amendment_requested',
  'amendment_rejected'
);

-- ─── Sezioni (hardcoded, non modificabili via UI) ─────────────────────────────

CREATE TABLE "sections" (
  "code"        TEXT        NOT NULL,
  "label"       TEXT        NOT NULL,
  "description" TEXT        NOT NULL,
  "sort_order"  INTEGER     NOT NULL DEFAULT 0,
  CONSTRAINT "sections_pkey" PRIMARY KEY ("code")
);

-- ─── Profili ──────────────────────────────────────────────────────────────────

CREATE TABLE "profiles" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "name"        TEXT        NOT NULL,
  "description" TEXT,
  "active"      BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "profiles_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "profiles_name_unique" UNIQUE ("name")
);

CREATE TABLE "profile_sections" (
  "profile_id"   UUID NOT NULL,
  "section_code" TEXT NOT NULL,
  CONSTRAINT "profile_sections_pkey"
    PRIMARY KEY ("profile_id", "section_code"),
  CONSTRAINT "profile_sections_profile_id_fkey"
    FOREIGN KEY ("profile_id")   REFERENCES "profiles"("id") ON DELETE CASCADE,
  CONSTRAINT "profile_sections_section_code_fkey"
    FOREIGN KEY ("section_code") REFERENCES "sections"("code") ON DELETE CASCADE
);

-- ─── Ruoli ────────────────────────────────────────────────────────────────────

CREATE TABLE "roles" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "name"        TEXT        NOT NULL,
  "description" TEXT,
  "active"      BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "roles_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "roles_name_unique" UNIQUE ("name")
);

CREATE TABLE "role_profiles" (
  "role_id"    UUID NOT NULL,
  "profile_id" UUID NOT NULL,
  CONSTRAINT "role_profiles_pkey"
    PRIMARY KEY ("role_id", "profile_id"),
  CONSTRAINT "role_profiles_role_id_fkey"
    FOREIGN KEY ("role_id")    REFERENCES "roles"("id")    ON DELETE CASCADE,
  CONSTRAINT "role_profiles_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE
);

-- ─── Utenti ───────────────────────────────────────────────────────────────────

CREATE TABLE "users" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "first_name"    TEXT        NOT NULL,
  "last_name"     TEXT        NOT NULL,
  "email"         TEXT        NOT NULL,
  "password_hash" TEXT        NOT NULL,
  "role_id"       UUID        NOT NULL,
  "active"        BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "users_pkey"         PRIMARY KEY ("id"),
  CONSTRAINT "users_email_unique" UNIQUE ("email"),
  CONSTRAINT "users_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id")
);

-- ─── Clienti ──────────────────────────────────────────────────────────────────

CREATE TABLE "clients" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "name"       TEXT        NOT NULL,
  "code"       TEXT,
  "notes"      TEXT,
  "active"     BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "clients_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "clients_code_unique" UNIQUE ("code")
);

-- ─── Progetti ─────────────────────────────────────────────────────────────────

CREATE TABLE "projects" (
  "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  "client_id"           UUID        NOT NULL,
  "name"                TEXT        NOT NULL,
  "code"                TEXT,
  "responsible_user_id" UUID        NOT NULL,
  "notes"               TEXT,
  "active"              BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "projects_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "projects_code_unique" UNIQUE ("code"),
  CONSTRAINT "projects_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id"),
  CONSTRAINT "projects_responsible_user_id_fkey"
    FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id")
);

-- ─── Tipologie commessa ───────────────────────────────────────────────────────

CREATE TABLE "engagement_types" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "name"        TEXT        NOT NULL,
  "description" TEXT,
  "active"      BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "engagement_types_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "engagement_types_name_unique" UNIQUE ("name")
);

-- ─── Commesse ─────────────────────────────────────────────────────────────────

CREATE TABLE "engagements" (
  "id"                 UUID        NOT NULL DEFAULT gen_random_uuid(),
  "project_id"         UUID        NOT NULL,
  "engagement_type_id" UUID        NOT NULL,
  "name"               TEXT        NOT NULL,
  "code"               TEXT        NOT NULL,
  "notes"              TEXT,
  "active"             BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "engagements_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "engagements_code_unique" UNIQUE ("code"),
  CONSTRAINT "engagements_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id"),
  CONSTRAINT "engagements_engagement_type_id_fkey"
    FOREIGN KEY ("engagement_type_id") REFERENCES "engagement_types"("id")
);

-- ─── Utenti abilitati per commessa ───────────────────────────────────────────

CREATE TABLE "engagement_users" (
  "engagement_id" UUID NOT NULL,
  "user_id"       UUID NOT NULL,
  CONSTRAINT "engagement_users_pkey"
    PRIMARY KEY ("engagement_id", "user_id"),
  CONSTRAINT "engagement_users_engagement_id_fkey"
    FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE CASCADE,
  CONSTRAINT "engagement_users_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- ─── Festività italiane ───────────────────────────────────────────────────────

CREATE TABLE "italian_holidays" (
  "id"           UUID    NOT NULL DEFAULT gen_random_uuid(),
  "date"         DATE    NOT NULL,
  "name"         TEXT    NOT NULL,
  "is_recurring" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "italian_holidays_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "italian_holidays_date_unique" UNIQUE ("date")
);

-- ─── Voci di assenza ──────────────────────────────────────────────────────────

CREATE TABLE "absence_types" (
  "id"     UUID    NOT NULL DEFAULT gen_random_uuid(),
  "code"   TEXT    NOT NULL,
  "label"  TEXT    NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "absence_types_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "absence_types_code_unique" UNIQUE ("code")
);

-- ─── Righe consuntivazione ────────────────────────────────────────────────────

CREATE TABLE "timesheet_entries" (
  "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"         UUID        NOT NULL,
  "year"            INTEGER     NOT NULL,
  "month"           INTEGER     NOT NULL,
  "day"             INTEGER     NOT NULL,
  "engagement_id"   UUID,
  "absence_type_id" UUID,
  "hours"           INTEGER     NOT NULL,
  "notes"           TEXT,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "timesheet_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "timesheet_entries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id"),
  CONSTRAINT "timesheet_entries_engagement_id_fkey"
    FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id"),
  CONSTRAINT "timesheet_entries_absence_type_id_fkey"
    FOREIGN KEY ("absence_type_id") REFERENCES "absence_types"("id"),
  CONSTRAINT "timesheet_entries_hours_check"
    CHECK ("hours" >= 1 AND "hours" <= 24),
  CONSTRAINT "timesheet_entries_one_type_check"
    CHECK (
      ("engagement_id" IS NOT NULL AND "absence_type_id" IS NULL) OR
      ("engagement_id" IS NULL     AND "absence_type_id" IS NOT NULL)
    )
);

-- Indice per query frequenti (utente + periodo)
CREATE INDEX "timesheet_entries_user_period_idx"
  ON "timesheet_entries" ("user_id", "year", "month", "day");

-- ─── Stato mensile consuntivazione ───────────────────────────────────────────

CREATE TABLE "timesheet_months" (
  "id"                       UUID                NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                  UUID                NOT NULL,
  "year"                     INTEGER             NOT NULL,
  "month"                    INTEGER             NOT NULL,
  "status"                   "timesheet_status"  NOT NULL DEFAULT 'draft',
  "approved_at"              TIMESTAMPTZ,
  "amendment_requested_at"   TIMESTAMPTZ,
  "amendment_reason"         TEXT,
  "amendment_reviewed_by"    UUID,
  "amendment_reviewed_at"    TIMESTAMPTZ,
  "amendment_rejection_reason" TEXT,
  "created_at"               TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  "updated_at"               TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  CONSTRAINT "timesheet_months_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "timesheet_months_user_year_month_unique"
    UNIQUE ("user_id", "year", "month"),
  CONSTRAINT "timesheet_months_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id"),
  CONSTRAINT "timesheet_months_amendment_reviewed_by_fkey"
    FOREIGN KEY ("amendment_reviewed_by") REFERENCES "users"("id")
);

-- ─── Tipi veicolo ─────────────────────────────────────────────────────────────

CREATE TABLE "vehicle_types" (
  "id"           UUID          NOT NULL DEFAULT gen_random_uuid(),
  "name"         TEXT          NOT NULL,
  "rate_per_km"  NUMERIC(6,4)  NOT NULL,
  "active"       BOOLEAN       NOT NULL DEFAULT TRUE,
  "created_at"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "vehicle_types_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "vehicle_types_name_unique" UNIQUE ("name")
);

-- ─── Categorie nota spese ─────────────────────────────────────────────────────

CREATE TABLE "expense_categories" (
  "id"                  UUID    NOT NULL DEFAULT gen_random_uuid(),
  "code"                TEXT    NOT NULL,
  "label"               TEXT    NOT NULL,
  "requires_attachment" BOOLEAN NOT NULL DEFAULT TRUE,
  "is_km_based"         BOOLEAN NOT NULL DEFAULT FALSE,
  "active"              BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "expense_categories_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "expense_categories_code_unique" UNIQUE ("code")
);

-- ─── Testata nota spese ───────────────────────────────────────────────────────

CREATE TABLE "expense_reports" (
  "id"                        UUID             NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                   UUID             NOT NULL,
  "year"                      INTEGER          NOT NULL,
  "month"                     INTEGER          NOT NULL,
  "title"                     TEXT             NOT NULL,
  "total_amount"              NUMERIC(10,2)    NOT NULL DEFAULT 0,
  "currency"                  TEXT             NOT NULL DEFAULT 'EUR',
  "status"                    "expense_status" NOT NULL DEFAULT 'draft',
  "approved_at"               TIMESTAMPTZ,
  "amendment_requested_at"    TIMESTAMPTZ,
  "amendment_reason"          TEXT,
  "amendment_reviewed_by"     UUID,
  "amendment_reviewed_at"     TIMESTAMPTZ,
  "amendment_rejection_reason" TEXT,
  "created_at"                TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "updated_at"                TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT "expense_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "expense_reports_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id"),
  CONSTRAINT "expense_reports_amendment_reviewed_by_fkey"
    FOREIGN KEY ("amendment_reviewed_by") REFERENCES "users"("id")
);

CREATE INDEX "expense_reports_user_period_idx"
  ON "expense_reports" ("user_id", "year", "month");

-- ─── Righe nota spese ─────────────────────────────────────────────────────────

CREATE TABLE "expense_lines" (
  "id"                  UUID          NOT NULL DEFAULT gen_random_uuid(),
  "report_id"           UUID          NOT NULL,
  "category_id"         UUID          NOT NULL,
  "engagement_id"       UUID,
  "date"                DATE          NOT NULL,
  "description"         TEXT          NOT NULL,
  "amount"              NUMERIC(10,2) NOT NULL,
  "currency"            TEXT          NOT NULL DEFAULT 'EUR',
  "exchange_rate"       NUMERIC(10,6) NOT NULL DEFAULT 1,
  "amount_eur"          NUMERIC(10,2) NOT NULL,
  "km_distance"         NUMERIC(7,2),
  "vehicle_type_id"     UUID,
  "attachment_key"      TEXT,
  "attachment_filename" TEXT,
  "created_at"          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "expense_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "expense_lines_report_id_fkey"
    FOREIGN KEY ("report_id") REFERENCES "expense_reports"("id") ON DELETE CASCADE,
  CONSTRAINT "expense_lines_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id"),
  CONSTRAINT "expense_lines_engagement_id_fkey"
    FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id"),
  CONSTRAINT "expense_lines_vehicle_type_id_fkey"
    FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("id")
);

CREATE INDEX "expense_lines_report_idx"
  ON "expense_lines" ("report_id");
