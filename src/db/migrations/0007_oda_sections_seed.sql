-- Inserisce le 4 nuove sezioni di permesso introdotte dalla feature OdA
-- e aggiorna i sortOrder esistenti per mantenerli interi consecutivi 1..20.
-- Idempotente: ON CONFLICT garantisce sicurezza in caso di rerun.

-- 1) Nuove sezioni
INSERT INTO "sections" ("code", "label", "description", "sort_order") VALUES
  ('PURCHASE_ORDERS_VIEW',      'Visualizzazione OdA',       'Visualizzazione ordini di acquisto e posizioni',                                                                            8),
  ('PURCHASE_ORDERS_MANAGE',    'Gestione OdA',              'Creazione e modifica ordini di acquisto. Abilita anche a essere selezionato come responsabile OdA.',                          9),
  ('PARAM_ENGAGEMENT_STATUSES', 'Stati commessa',            'Gestione tabella stati commessa (codice + descrizione)',                                                                   18),
  ('PARAM_PO_LINE_STATUSES',    'Stati posizione OdA',       'Gestione tabella stati posizione OdA (codice + descrizione)',                                                              19)
ON CONFLICT ("code") DO UPDATE SET
  "label"       = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "sort_order"  = EXCLUDED."sort_order";

-- 2) Riallinea sort_order delle sezioni esistenti (1..20 senza buchi)
UPDATE "sections" SET "sort_order" =  1 WHERE "code" = 'TIMESHEET';
UPDATE "sections" SET "sort_order" =  2 WHERE "code" = 'TIMESHEET_AMENDMENT';
UPDATE "sections" SET "sort_order" =  3 WHERE "code" = 'TIMESHEET_EXTRA';
UPDATE "sections" SET "sort_order" =  4 WHERE "code" = 'EXPENSES';
UPDATE "sections" SET "sort_order" =  5 WHERE "code" = 'EXPENSES_AMENDMENT';
UPDATE "sections" SET "sort_order" =  6 WHERE "code" = 'CLIENTS_VIEW';
UPDATE "sections" SET "sort_order" =  7 WHERE "code" = 'CLIENTS_MANAGE';
UPDATE "sections" SET "sort_order" = 10 WHERE "code" = 'FINANCE_DASHBOARD';
UPDATE "sections" SET "sort_order" = 11 WHERE "code" = 'FINANCE_AMENDMENT';
UPDATE "sections" SET "sort_order" = 12 WHERE "code" = 'FINANCE_EXPORT';
UPDATE "sections" SET "sort_order" = 13 WHERE "code" = 'PARAM_USERS';
UPDATE "sections" SET "sort_order" = 14 WHERE "code" = 'PARAM_ROLES';
UPDATE "sections" SET "sort_order" = 15 WHERE "code" = 'PARAM_ABSENCES';
UPDATE "sections" SET "sort_order" = 16 WHERE "code" = 'PARAM_EXPENSE_CAT';
UPDATE "sections" SET "sort_order" = 17 WHERE "code" = 'PARAM_ENGAGEMENTS';
UPDATE "sections" SET "sort_order" = 20 WHERE "code" = 'PARAM_HOLIDAYS';
