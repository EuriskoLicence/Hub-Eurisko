-- Crea la sequence per la codifica progressiva 6 cifre delle OdA.
-- Era stata aggiunta manualmente alla migration 0006 dopo l'applicazione
-- in produzione, quindi non era stata creata. Idempotente.

CREATE SEQUENCE IF NOT EXISTS "purchase_orders_code_seq"
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;
