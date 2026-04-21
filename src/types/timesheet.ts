export type TimesheetStatus =
  | 'draft'
  | 'approved'
  | 'amendment_requested'
  | 'amendment_rejected'

export type MonthStatusRecord = {
  id:                       string
  status:                   TimesheetStatus
  approvedAt:               string | null
  amendmentRequestedAt:     string | null
  amendmentReason:          string | null
  amendmentReviewedBy:      string | null
  amendmentReviewedAt:      string | null
  amendmentRejectionReason: string | null
}

export type EngagementOption = {
  id:          string
  name:        string
  code:        string
  projectName: string
  clientName:  string
}

export type AbsenceOption = {
  id:        string
  shortCode: string | null
  label:     string
}

/** Giorno del calendario serializzato (senza oggetti Date, passabile server→client) */
export type CalendarDaySerialized = {
  isoDate:     string   // "YYYY-MM-DD"
  dayOfMonth:  number   // 1-31
  dayOfWeek:   number   // 0=Dom, 1=Lun … 6=Sab
  dayAbbr:     string   // "Lun", "Mar" …
  isWeekend:   boolean
  isHoliday:   boolean
  holidayName: string | null
  isWorkingDay: boolean
}

/** Entry come viene salvata nel DB */
export type EntryRecord = {
  id:            string
  day:           number
  engagementId:  string | null
  absenceTypeId: string | null
  hours:         number
  notes:         string | null
}

/** Entry da inviare al server per il salvataggio */
export type SaveEntry = {
  day:           number
  engagementId:  string | null
  absenceTypeId: string | null
  hours:         number
  notes?:        string | null
}

/** Dati completi caricati dalla page e passati al MonthGrid */
export type TimesheetPageData = {
  year:        number
  month:       number
  isFuture:    boolean
  monthStatus: MonthStatusRecord | null
  entries:     EntryRecord[]
  engagements: EngagementOption[]
  absences:    AbsenceOption[]
  calendar:    CalendarDaySerialized[]
}

/** Riga della griglia (stato locale client) */
export type GridRow = {
  type:     'engagement' | 'absence'
  id:       string
  label:    string
  sublabel: string
  hours:    Record<number, number | ''>  // day (1-31) → ore o stringa vuota
}

/** Sommario mese per la lista */
export type MonthSummary = {
  year:         number
  month:        number
  monthLabel:   string
  status:       TimesheetStatus | 'not_started'
  totalHours:   number
  workingDays:  number
}
