// Sezioni hardcoded — non modificabili via UI.
// Ogni sezione corrisponde a una funzionalità del portale.
// I profili e i ruoli (configurabili dall'admin) aggregano queste sezioni.

export const SECTIONS = {
  // ─── Consuntivazione ────────────────────────────────────────────────────────
  TIMESHEET:           'TIMESHEET',           // Inserimento propria consuntivazione mensile
  TIMESHEET_AMENDMENT: 'TIMESHEET_AMENDMENT', // Richiesta rettifica propria consuntivazione
  TIMESHEET_EXTRA:     'TIMESHEET_EXTRA',     // Consuntivazione ore extra (profilo Dipendente Plus)

  // ─── Nota spese ─────────────────────────────────────────────────────────────
  EXPENSES:            'EXPENSES',            // Inserimento proprie note spese
  EXPENSES_AMENDMENT:  'EXPENSES_AMENDMENT',  // Richiesta rettifica proprie note spese

  // ─── Gestione clienti / progetti / commesse ──────────────────────────────────
  CLIENTS_VIEW:        'CLIENTS_VIEW',        // Visualizzazione clienti, progetti, commesse
  CLIENTS_MANAGE:      'CLIENTS_MANAGE',      // Creazione e modifica (con regole di ownership)

  // ─── HR Finance ─────────────────────────────────────────────────────────────
  FINANCE_DASHBOARD:   'FINANCE_DASHBOARD',   // Dashboard riepilogativa
  FINANCE_AMENDMENT:   'FINANCE_AMENDMENT',   // Gestione rettifiche (approva/rifiuta)
  FINANCE_EXPORT:      'FINANCE_EXPORT',      // Esportazione dati

  // ─── Parametrizzazioni (backoffice) ──────────────────────────────────────────
  PARAM_USERS:         'PARAM_USERS',         // Creazione e gestione utenti
  PARAM_ROLES:         'PARAM_ROLES',         // Creazione e gestione profili e ruoli
  PARAM_ABSENCES:      'PARAM_ABSENCES',      // Gestione voci di assenza
  PARAM_EXPENSE_CAT:   'PARAM_EXPENSE_CAT',   // Gestione categorie nota spese e tipi veicolo
  PARAM_ENGAGEMENTS:   'PARAM_ENGAGEMENTS',   // Gestione tipologie commessa
  PARAM_HOLIDAYS:      'PARAM_HOLIDAYS',      // Gestione festività italiane
} as const

export type SectionCode = keyof typeof SECTIONS

// Metadati leggibili per l'UI admin (tab Sezioni, label checklist profili)
export const SECTIONS_META: Record<SectionCode, { label: string; description: string; sortOrder: number; area: string }> = {
  TIMESHEET:           { label: 'Consuntivazione',           description: 'Inserimento propria consuntivazione mensile',                        sortOrder:  1, area: 'Consuntivazione' },
  TIMESHEET_AMENDMENT: { label: 'Rettifica consuntivazione', description: 'Richiesta rettifica propria consuntivazione',                         sortOrder:  2, area: 'Consuntivazione' },
  TIMESHEET_EXTRA:     { label: 'Consuntivazione extra',     description: 'Consuntivazione ore extra (profilo Dipendente Plus)',                  sortOrder:  3, area: 'Consuntivazione' },
  EXPENSES:            { label: 'Nota spese',                description: 'Inserimento proprie note spese',                                       sortOrder:  3, area: 'Nota spese' },
  EXPENSES_AMENDMENT:  { label: 'Rettifica nota spese',      description: 'Richiesta rettifica proprie note spese',                              sortOrder:  4, area: 'Nota spese' },
  CLIENTS_VIEW:        { label: 'Visualizzazione clienti',   description: 'Visualizzazione clienti, progetti e commesse',                         sortOrder:  5, area: 'Clienti' },
  CLIENTS_MANAGE:      { label: 'Gestione clienti',          description: 'Creazione e modifica clienti, progetti e commesse (con ownership)',     sortOrder:  6, area: 'Clienti' },
  FINANCE_DASHBOARD:   { label: 'Dashboard HR Finance',      description: 'Dashboard riepilogativa consuntivazioni e note spese',                  sortOrder:  7, area: 'HR Finance' },
  FINANCE_AMENDMENT:   { label: 'Gestione rettifiche',       description: 'Approvazione e rifiuto richieste di rettifica',                        sortOrder:  8, area: 'HR Finance' },
  FINANCE_EXPORT:      { label: 'Esportazione dati',         description: 'Esportazione dati consuntivazioni e note spese in CSV/Excel',          sortOrder:  9, area: 'HR Finance' },
  PARAM_USERS:         { label: 'Gestione utenti',           description: 'Creazione e gestione utenti del sistema',                               sortOrder: 10, area: 'Parametrizzazioni' },
  PARAM_ROLES:         { label: 'Gestione ruoli e profili',  description: 'Creazione e gestione profili e ruoli di autorizzazione',               sortOrder: 11, area: 'Parametrizzazioni' },
  PARAM_ABSENCES:      { label: 'Voci di assenza',           description: 'Gestione voci di assenza (ferie, malattia, permesso, ecc.)',           sortOrder: 12, area: 'Parametrizzazioni' },
  PARAM_EXPENSE_CAT:   { label: 'Categorie spese',           description: 'Gestione categorie nota spese e tipi veicolo',                         sortOrder: 13, area: 'Parametrizzazioni' },
  PARAM_ENGAGEMENTS:   { label: 'Tipologie commessa',        description: 'Gestione tipologie commessa (chiavi in mano, T&M, ecc.)',              sortOrder: 14, area: 'Parametrizzazioni' },
  PARAM_HOLIDAYS:      { label: 'Festività',                 description: 'Gestione festività italiane e aziendali',                               sortOrder: 15, area: 'Parametrizzazioni' },
}
