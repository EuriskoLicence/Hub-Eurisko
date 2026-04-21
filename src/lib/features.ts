/**
 * Feature flags — variabili interne per attivare/disattivare funzionalità.
 * Non sono variabili d'ambiente né parametrizzazioni UI.
 * Per modificarle occorre aggiornare questo file e fare un nuovo deploy.
 */

/** Abilita la gestione degli allegati nelle note spese (richiede Cloudflare R2 configurato) */
export const ATTACHMENTS_ENABLED = true
