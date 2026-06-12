-- Inserisce le 2 nuove sezioni di permesso della feature Fatturazione
-- e riallinea i sort_order esistenti (interi consecutivi 1..22).
-- Idempotente: ON CONFLICT garantisce sicurezza in caso di rerun.

-- 1) Nuove sezioni
INSERT INTO "sections" ("code", "label", "description", "sort_order") VALUES
  ('INVOICES_VIEW',   'Visualizzazione fatturazione', 'Visualizzazione fatture, note credito e posizioni',                       10),
  ('INVOICES_MANAGE', 'Gestione fatturazione',        'Creazione, modifica ed eliminazione fatture, posizioni e allegati',      11)
ON CONFLICT ("code") DO UPDATE SET
  "label"       = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "sort_order"  = EXCLUDED."sort_order";

-- 2) Riallinea sort_order delle sezioni shiftate
UPDATE "sections" SET "sort_order" = 12 WHERE "code" = 'FINANCE_DASHBOARD';
UPDATE "sections" SET "sort_order" = 13 WHERE "code" = 'FINANCE_AMENDMENT';
UPDATE "sections" SET "sort_order" = 14 WHERE "code" = 'FINANCE_EXPORT';
UPDATE "sections" SET "sort_order" = 15 WHERE "code" = 'PARAM_USERS';
UPDATE "sections" SET "sort_order" = 16 WHERE "code" = 'PARAM_ROLES';
UPDATE "sections" SET "sort_order" = 17 WHERE "code" = 'PARAM_ABSENCES';
UPDATE "sections" SET "sort_order" = 18 WHERE "code" = 'PARAM_EXPENSE_CAT';
UPDATE "sections" SET "sort_order" = 19 WHERE "code" = 'PARAM_ENGAGEMENTS';
UPDATE "sections" SET "sort_order" = 20 WHERE "code" = 'PARAM_ENGAGEMENT_STATUSES';
UPDATE "sections" SET "sort_order" = 21 WHERE "code" = 'PARAM_PO_LINE_STATUSES';
UPDATE "sections" SET "sort_order" = 22 WHERE "code" = 'PARAM_HOLIDAYS';
