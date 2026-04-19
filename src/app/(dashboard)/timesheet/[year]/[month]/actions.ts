'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, inArray } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  timesheetEntries,
  timesheetMonths,
  engagementUsers,
  engagements,
  projects,
  clients,
  absenceTypes,
  users,
} from '@/db/schema'
import { requireSection, HttpError } from '@/lib/permissions/auth-helpers'
import { getMonthCalendar } from '@/lib/italian-calendar'
import { sendAmendmentRequestedEmail, sendAmendmentReviewedEmail } from '@/lib/email'
import type {
  TimesheetPageData,
  CalendarDaySerialized,
  SaveEntry,
  MonthStatusRecord,
} from '@/types/timesheet'

// ─── Utility ──────────────────────────────────────────────────────────────────

const IT_DAY_ABBR  = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const IT_MONTHS    = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                      'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

function isFutureMonth(year: number, month: number): boolean {
  const now = new Date()
  return year > now.getFullYear() ||
    (year === now.getFullYear() && month > now.getMonth() + 1)
}

// ─── Caricamento dati pagina ──────────────────────────────────────────────────

export async function getTimesheetPageData(
  year:  number,
  month: number,
): Promise<TimesheetPageData> {
  const session = await auth()
  requireSection(session, 'TIMESHEET')
  const userId = session.user.id

  // Stato mese
  const monthRows = await db
    .select()
    .from(timesheetMonths)
    .where(
      and(
        eq(timesheetMonths.userId, userId),
        eq(timesheetMonths.year,   year),
        eq(timesheetMonths.month,  month),
      ),
    )
    .limit(1)

  const monthStatus: MonthStatusRecord | null = monthRows[0]
    ? {
        id:                       monthRows[0].id,
        status:                   monthRows[0].status as any,
        approvedAt:               monthRows[0].approvedAt?.toISOString() ?? null,
        amendmentRequestedAt:     monthRows[0].amendmentRequestedAt?.toISOString() ?? null,
        amendmentReason:          monthRows[0].amendmentReason ?? null,
        amendmentReviewedBy:      monthRows[0].amendmentReviewedBy ?? null,
        amendmentReviewedAt:      monthRows[0].amendmentReviewedAt?.toISOString() ?? null,
        amendmentRejectionReason: monthRows[0].amendmentRejectionReason ?? null,
      }
    : null

  // Entries del mese
  const entryRows = await db
    .select()
    .from(timesheetEntries)
    .where(
      and(
        eq(timesheetEntries.userId, userId),
        eq(timesheetEntries.year,   year),
        eq(timesheetEntries.month,  month),
      ),
    )

  const entryRecords = entryRows.map((r) => ({
    id:            r.id,
    day:           r.day,
    engagementId:  r.engagementId  ?? null,
    absenceTypeId: r.absenceTypeId ?? null,
    hours:         r.hours,
    notes:         r.notes ?? null,
  }))

  // Commesse abilitate per l'utente (solo attive)
  const engRows = await db
    .select({
      id:          engagements.id,
      name:        engagements.name,
      code:        engagements.code,
      projectName: projects.name,
      clientName:  clients.name,
    })
    .from(engagementUsers)
    .innerJoin(engagements, eq(engagementUsers.engagementId, engagements.id))
    .innerJoin(projects,    eq(engagements.projectId,        projects.id))
    .innerJoin(clients,     eq(projects.clientId,            clients.id))
    .where(
      and(
        eq(engagementUsers.userId, userId),
        eq(engagements.active,     true),
        eq(projects.active,        true),
        eq(clients.active,         true),
      ),
    )

  // Voci assenza attive
  const absRows = await db
    .select()
    .from(absenceTypes)
    .where(eq(absenceTypes.active, true))

  // Calendario del mese (con festività dal DB)
  const calDays = await getMonthCalendar(year, month)

  const calendar: CalendarDaySerialized[] = calDays.map((d) => ({
    isoDate:     d.isoDate,
    dayOfMonth:  d.date.getUTCDate(),
    dayOfWeek:   d.dayOfWeek,
    dayAbbr:     IT_DAY_ABBR[d.dayOfWeek],
    isWeekend:   d.isWeekend,
    isHoliday:   d.isHoliday,
    holidayName: d.holidayName,
    isWorkingDay: d.isWorkingDay,
  }))

  return {
    year,
    month,
    isFuture:    isFutureMonth(year, month),
    monthStatus,
    entries:     entryRecords,
    engagements: engRows,
    absences:    absRows.map((a) => ({ id: a.id, code: a.code, label: a.label })),
    calendar,
  }
}

// ─── Lista mesi per anno (griglia annuale) ────────────────────────────────────

export async function getTimesheetYearData(year: number) {
  const session = await auth()
  requireSection(session, 'TIMESHEET')
  const userId = session.user.id

  const now      = new Date()
  const curYear  = now.getFullYear()
  const curMonth = now.getMonth() + 1

  // Carica stati dal DB per l'anno richiesto
  const statusRows = await db
    .select()
    .from(timesheetMonths)
    .where(and(eq(timesheetMonths.userId, userId), eq(timesheetMonths.year, year)))

  const statusMap = new Map(statusRows.map((r) => [r.month, r]))

  // Conta ore per mese nell'anno richiesto
  const entryRows = await db
    .select()
    .from(timesheetEntries)
    .where(and(eq(timesheetEntries.userId, userId), eq(timesheetEntries.year, year)))

  const hoursMap = new Map<number, number>()
  for (const e of entryRows) {
    hoursMap.set(e.month, (hoursMap.get(e.month) ?? 0) + e.hours)
  }

  const months = Array.from({ length: 12 }, (_, i) => {
    const month  = i + 1
    const status = statusMap.get(month)
    const isFuture = year > curYear || (year === curYear && month > curMonth)
    return {
      year,
      month,
      monthLabel:  IT_MONTHS[month - 1],
      status:      (status?.status ?? 'not_started') as 'not_started' | 'draft' | 'approved' | 'amendment_requested' | 'amendment_rejected',
      totalHours:  hoursMap.get(month) ?? 0,
      isCurrent:   year === curYear && month === curMonth,
      isFuture,
    }
  })

  const submitted = months.filter((m) => m.status === 'approved' || m.status === 'amendment_requested' || m.status === 'amendment_rejected').length
  const draft     = months.filter((m) => m.status === 'draft').length
  const notOpened = months.filter((m) => m.status === 'not_started').length

  return { months, summary: { submitted, draft, notOpened }, currentYear: curYear }
}

// ─── Salvataggio bozza ────────────────────────────────────────────────────────

export async function saveTimesheetEntries(
  year:    number,
  month:   number,
  entries: SaveEntry[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'TIMESHEET')
    const userId = session.user.id

    if (isFutureMonth(year, month)) {
      return { ok: false, error: 'Non puoi modificare mesi futuri.' }
    }

    // Controlla stato: solo draft è editabile
    const monthRow = await db
      .select({ status: timesheetMonths.status })
      .from(timesheetMonths)
      .where(
        and(
          eq(timesheetMonths.userId, userId),
          eq(timesheetMonths.year,   year),
          eq(timesheetMonths.month,  month),
        ),
      )
      .limit(1)

    const currentStatus = monthRow[0]?.status ?? 'draft'
    if (currentStatus !== 'draft') {
      return { ok: false, error: 'Il mese non è in bozza: non puoi modificare le ore.' }
    }

    // Recupera le commesse abilitate per l'utente
    const allowedEngRows = await db
      .select({ engagementId: engagementUsers.engagementId })
      .from(engagementUsers)
      .where(eq(engagementUsers.userId, userId))

    const allowedEngIds = new Set(allowedEngRows.map((r) => r.engagementId))

    // Valida le entries
    const dayTotals = new Map<number, number>()
    for (const e of entries) {
      if (e.hours < 1 || e.hours > 8 || !Number.isInteger(e.hours)) {
        return { ok: false, error: `Le ore devono essere un intero tra 1 e 8 (giorno ${e.day}).` }
      }
      if ((e.engagementId == null) === (e.absenceTypeId == null)) {
        return { ok: false, error: `Ogni riga deve avere esattamente uno tra commessa e assenza (giorno ${e.day}).` }
      }
      if (e.engagementId && !allowedEngIds.has(e.engagementId)) {
        return { ok: false, error: 'Commessa non abilitata per questo utente.' }
      }
      dayTotals.set(e.day, (dayTotals.get(e.day) ?? 0) + e.hours)
    }
    for (const [day, total] of Array.from(dayTotals)) {
      if (total > 8) {
        return { ok: false, error: `Il giorno ${day} supera le 8 ore giornaliere (${total}h inserite).` }
      }
    }

    // Salva: delete + insert (sequenziale — neon-http non supporta transazioni)
    await db
      .delete(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.userId, userId),
          eq(timesheetEntries.year,   year),
          eq(timesheetEntries.month,  month),
        ),
      )

    if (entries.length > 0) {
      await db.insert(timesheetEntries).values(
        entries.map((e) => ({
          userId,
          year,
          month,
          day:           e.day,
          engagementId:  e.engagementId  ?? null,
          absenceTypeId: e.absenceTypeId ?? null,
          hours:         e.hours,
          notes:         e.notes ?? null,
        })),
      )
    }

    // Crea il record mese in 'draft' se non esiste ancora
    await db
      .insert(timesheetMonths)
      .values({ userId, year, month, status: 'draft' })
      .onConflictDoUpdate({
        target: [timesheetMonths.userId, timesheetMonths.year, timesheetMonths.month],
        set: { updatedAt: new Date() },
      })

    revalidatePath(`/timesheet/${year}/${month}`)
    revalidatePath('/timesheet')
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('saveTimesheetEntries error:', err)
    return { ok: false, error: 'Errore del server. Riprova.' }
  }
}

// ─── Invio definitivo (draft → approved) ─────────────────────────────────────

export async function submitTimesheet(
  year:  number,
  month: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'TIMESHEET')
    const userId = session.user.id

    if (isFutureMonth(year, month)) {
      return { ok: false, error: 'Non puoi inviare mesi futuri.' }
    }

    const now = new Date()

    const existing = await db
      .select({ id: timesheetMonths.id, status: timesheetMonths.status })
      .from(timesheetMonths)
      .where(
        and(
          eq(timesheetMonths.userId, userId),
          eq(timesheetMonths.year,   year),
          eq(timesheetMonths.month,  month),
        ),
      )
      .limit(1)

    if (existing.length > 0 && existing[0].status !== 'draft') {
      return { ok: false, error: 'Il mese non è in bozza.' }
    }

    // Verifica che tutti i giorni lavorativi abbiano esattamente 8 ore
    const calDays = await getMonthCalendar(year, month)
    const workingDays = calDays.filter((d) => d.isWorkingDay).map((d) => d.date.getUTCDate())

    const entryRows = await db
      .select({ day: timesheetEntries.day, hours: timesheetEntries.hours })
      .from(timesheetEntries)
      .where(and(eq(timesheetEntries.userId, userId), eq(timesheetEntries.year, year), eq(timesheetEntries.month, month)))

    const dayTotalsMap = new Map<number, number>()
    for (const e of entryRows) dayTotalsMap.set(e.day, (dayTotalsMap.get(e.day) ?? 0) + e.hours)

    const incompleteDays = workingDays.filter((d) => (dayTotalsMap.get(d) ?? 0) !== 8)
    if (incompleteDays.length > 0) {
      return { ok: false, error: `Non puoi inviare: ${incompleteDays.length} giorni lavorativi non hanno 8 ore (giorni: ${incompleteDays.join(', ')}).` }
    }

    if (existing.length === 0) {
      await db.insert(timesheetMonths).values({
        userId,
        year,
        month,
        status:     'approved',
        approvedAt: now,
      })
    } else {
      await db
        .update(timesheetMonths)
        .set({ status: 'approved', approvedAt: now, updatedAt: now })
        .where(eq(timesheetMonths.id, existing[0].id))
    }

    revalidatePath(`/timesheet/${year}/${month}`)
    revalidatePath('/timesheet')
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('submitTimesheet error:', err)
    return { ok: false, error: 'Errore del server. Riprova.' }
  }
}

// ─── Richiesta rettifica (approved | amendment_rejected → amendment_requested) ──

export async function requestTimesheetAmendment(
  year:   number,
  month:  number,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'TIMESHEET_AMENDMENT')
    const userId = session.user.id

    if (!reason.trim()) {
      return { ok: false, error: 'Il motivo è obbligatorio.' }
    }

    const existing = await db
      .select({ id: timesheetMonths.id, status: timesheetMonths.status })
      .from(timesheetMonths)
      .where(
        and(
          eq(timesheetMonths.userId, userId),
          eq(timesheetMonths.year,   year),
          eq(timesheetMonths.month,  month),
        ),
      )
      .limit(1)

    if (!existing.length) {
      return { ok: false, error: 'Nessuna consuntivazione trovata per questo mese.' }
    }

    const { status } = existing[0]
    if (status !== 'approved' && status !== 'amendment_rejected') {
      return { ok: false, error: 'Non è possibile richiedere una rettifica in questo stato.' }
    }

    const now = new Date()
    await db
      .update(timesheetMonths)
      .set({
        status:               'amendment_requested',
        amendmentRequestedAt: now,
        amendmentReason:      reason.trim(),
        updatedAt:            now,
      })
      .where(eq(timesheetMonths.id, existing[0].id))

    revalidatePath(`/timesheet/${year}/${month}`)
    revalidatePath('/timesheet')

    // Email asincrona a HR Finance
    const { firstName, lastName, email } = session.user
    sendAmendmentRequestedEmail({
      type:      'timesheet',
      userName:  `${firstName} ${lastName}`,
      userEmail: email,
      year,
      month,
      reason:    reason.trim(),
    })

    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('requestTimesheetAmendment error:', err)
    return { ok: false, error: 'Errore del server. Riprova.' }
  }
}

// ─── Revisione rettifica (HR Finance) ─────────────────────────────────────────

export async function reviewTimesheetAmendment(
  timesheetMonthId: string,
  action:           'approve' | 'reject',
  rejectionReason?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'FINANCE_AMENDMENT')
    const reviewerId = session.user.id

    if (action === 'reject' && !rejectionReason?.trim()) {
      return { ok: false, error: 'Il motivo del rifiuto è obbligatorio.' }
    }

    const row = await db
      .select({
        id:        timesheetMonths.id,
        status:    timesheetMonths.status,
        userId:    timesheetMonths.userId,
        year:      timesheetMonths.year,
        month:     timesheetMonths.month,
        firstName: users.firstName,
        lastName:  users.lastName,
        email:     users.email,
      })
      .from(timesheetMonths)
      .innerJoin(users, eq(users.id, timesheetMonths.userId))
      .where(eq(timesheetMonths.id, timesheetMonthId))
      .limit(1)

    if (!row.length) return { ok: false, error: 'Record non trovato.' }
    if (row[0].status !== 'amendment_requested') {
      return { ok: false, error: 'La rettifica non è in attesa di revisione.' }
    }

    const now = new Date()
    await db
      .update(timesheetMonths)
      .set({
        status:                    action === 'approve' ? 'draft' : 'amendment_rejected',
        amendmentReviewedBy:       reviewerId,
        amendmentReviewedAt:       now,
        amendmentRejectionReason:  action === 'reject' ? rejectionReason!.trim() : null,
        updatedAt:                 now,
      })
      .where(eq(timesheetMonths.id, timesheetMonthId))

    revalidatePath('/finance/amendments')

    // Email asincrona all'utente
    sendAmendmentReviewedEmail({
      type:             'timesheet',
      userEmail:        row[0].email,
      userName:         `${row[0].firstName} ${row[0].lastName}`,
      year:             row[0].year,
      month:            row[0].month,
      action,
      rejectionReason:  action === 'reject' ? rejectionReason : undefined,
    })

    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('reviewTimesheetAmendment error:', err)
    return { ok: false, error: 'Errore del server. Riprova.' }
  }
}
