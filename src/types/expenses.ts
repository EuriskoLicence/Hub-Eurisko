export type ExpenseStatus =
  | 'draft'
  | 'approved'
  | 'amendment_requested'
  | 'amendment_rejected'

export type ExpenseCategoryOption = {
  id:                 string
  code:               string
  label:              string
  requiresAttachment: boolean
  isKmBased:          boolean
}

export type EngagementOption = {
  id:          string
  name:        string
  code:        string
  projectName: string
  clientName:  string
}

/** Singola cella della griglia: un'expense_line per un giorno specifico */
export type CellData = {
  lineId?:            string   // DB id se già salvato
  amount:             string   // importo originale (EUR per default)
  currency:           string   // default 'EUR'
  exchangeRate:       string   // default '1'
  amountEur:          string   // calcolato: amount * exchangeRate (o km * rate)
  kmDistance:         string   // solo per is_km_based ('' se vuota)
  description:        string
  attachmentKey:      string | null
  attachmentFilename: string | null
}

/** Riga della griglia nota spese */
export type ExpenseRowState = {
  localId:            string                           // React key
  categoryId:         string
  categoryLabel:      string
  categoryCode:       string
  requiresAttachment: boolean
  isKmBased:          boolean
  engagementId:       string | null
  engagementName:     string | null                    // nome commessa (per visualizzazione)
  kmRate:             string | null                    // tariffa km dell'utente (per calcolo EUR da km)
  cells:              Record<number, CellData | null>  // day (1-31) → dati cella
}

/** Report (testata) serializzato server→client */
export type ExpenseReportData = {
  id:                       string
  year:                     number
  month:                    number
  title:                    string
  totalAmount:              string
  currency:                 string
  status:                   ExpenseStatus
  approvedAt:               string | null
  amendmentRequestedAt:     string | null
  amendmentReason:          string | null
  amendmentRejectionReason: string | null
  amendmentReviewedBy:      string | null
}

/** Dati completi pagina griglia spese */
export type ExpensePageData = {
  report:       ExpenseReportData | null  // null = primo accesso, nessun salvataggio ancora
  year:         number
  month:        number
  isFuture:     boolean
  rows:         ExpenseRowState[]   // pre-costruite dal server
  categories:   ExpenseCategoryOption[]
  engagements:  EngagementOption[]
  userTariffaKm: string | null      // tariffa km dell'utente (per categorie km-based)
  calendar:     import('@/types/timesheet').CalendarDaySerialized[]
}

/** Linea da inviare al server per il salvataggio */
export type SaveLine = {
  categoryId:         string
  engagementId:       string | null
  tariffaKm:          string | null   // tariffa €/km al momento del salvataggio (solo per righe km-based)
  day:                number
  description:        string
  amount:             string
  currency:           string
  exchangeRate:       string
  amountEur:          string
  kmDistance:         string | null
  attachmentKey:      string | null
  attachmentFilename: string | null
}

/** Sommario per la lista */
export type ExpenseReportSummary = {
  id:          string
  year:        number
  month:       number
  monthLabel:  string
  title:       string
  totalAmount: string
  currency:    string
  status:      ExpenseStatus
}
