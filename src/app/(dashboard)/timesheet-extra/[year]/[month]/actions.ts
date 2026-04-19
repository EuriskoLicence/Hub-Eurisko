'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  timesheetExtraEntries,
  timesheetExtraMonths,
  engagementUsers,
  engagements,
  projects,
  clients,
} from '@/db/schema'
import { requireSection, HttpError } from '@/lib/permissions/auth-helpers'
import { getMonthCalendar } from '@/lib/italian-calendar'
import type {
  TimesheetPageData,
  CalendarDaySerialized,
  SaveEntry,
  MonthStatusRecord,
} from '@/types/timesheet'

// ─── Utility ──────────────────────────────────────────────────────────────────

const IT_DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const IT_MONTHS   = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                     'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

function isFutureMonth(year: number, month: number): boolean {
  const now = new Date()
  return year > now.getFullYear() ||
    (year === now.getFullYear() && month > now.getMonth() + 1)
}

// ─── Caricamento dati pagina ──────────────────────────────────────────────────

export async function getTimesheetExtraPageData(
  year:  number,
  month: number,
): Promise<TimesheetPageData> {
  const session = await auth()
  requireSection(session, 'TIMESHEET_EXTRA')
  const userId = session.user.id

  // Stato mese
  const monthRows = await db
    .select()
    .from(timesheetExtraMonths)
    .where(
      and(
        eq(timesheetExtraMonths.userId, userId),
        eq(timesheetExtraMonths.year,   year),
        eq(timesheetExtraMonths.month,  month),
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
    .from(timesheetExtraEntries)
    .where(
      and(
        eq(timesheetExtraEntries.userId, userId),
        eq(timesheetExtraEntries.year,   year),
        eq(timesheetExtraEntries.month,  month),
      ),
    )

  const entryRecords = entryRows.map((r) => ({
    id:            r.id,
    day:           r.day,
    engagementId:  r.engagementId  ?? null,
    absenceTypeId: null,  // non previsto nella consuntivazione extra
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

  // Calendario del mese (con festività)
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
    absences:    [],   // nessuna voce assenza nella consuntivazione extra
    calendar,
  }
}

// ─── Lista mesi per anno (griglia annuale) ────────────────────────────────────

export async function getTimesheetExtraYearData(year: number) {
  const session = await auth()
  requireSection(session, 'TIMESHEET_EXTRA')
  const userId = session.user.id

  const now      = new Date()
  const curYear  = now.getFullYear()
  const curMonth = now.getMonth() + 1

  const statusRows = await db
    .select()
    .from(timesheetExtraMonths)
    .where(and(eq(timesheetExtraMonths.userId, userId), eq(timesheetExtraMonths.year, year)))

  const statusMap = new Map(statusRows.map((r) => [r.month, r]))

  const entryRows = await db
    .select()
    .from(timesheetExtraEntries)
    .where(and(eq(timesheetExtraEntries.userId, userId), eq(timesheetExtraEntries.year, year)))

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

export async function saveTimesheetExtraEntries(
  year:    number,
  month:   number,
  entries: SaveEntry[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'TIMESHEET_EXTRA')
    const userId = session.user.id

    if (isFutureMonth(year, month)) {
      return { ok: false, error: 'Non puoi modificare mesi futuri.' }
    }

    const monthRow = await db
      .select({ status: timesheetExtraMonths.status })
      .from(timesheetExtraMonths)
      .where(
        and(
          eq(timesheetExtraMonths.userId, userId),
          eq(timesheetExtraMonths.year,   year),
          eq(timesheetExtraMonths.month,  month),
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

    // Valida le entries (solo engagement, nessuna assenza)
    const dayTotals = new Map<number, number>()
    for (const e of entries) {
      if (e.hours < 1 || e.hours > 24 || !Number.isInteger(e.hours)) {
        return { ok: false, error: `Le ore devono essere un intero tra 1 e 24 (giorno ${e.day}).` }
      }
      if (!e.engagementId) {
        return { ok: false, error: `Ogni riga deve essere associata a una commessa (giorno ${e.day}).` }
      }
      if (!allowedEngIds.has(e.engagementId)) {
        return { ok: false, error: 'Commessa non abilitata per questo utente.' }
      }
      dayTotals.set(e.day, (dayTotals.get(e.day) ?? 0) + e.hours)
    }
    for (const [day, total] of Array.from(dayTotals)) {
      if (total > 24) {
        return { ok: false, error: `Il giorno ${day} supera le 24 ore totali (${total}h inserite).` }
      }
    }

    // Salva: delete + insert
    await db
      .delete(timesheetExtraEntries)
      .where(
        and(
          eq(timesheetExtraEntries.userId, userId),
          eq(timesheetExtraEntries.year,   year),
          eq(timesheetExtraEntries.month,  month),
        ),
      )

    if (entries.length > 0) {
      await db.insert(timesheetExtraEntries).values(
        entries.map((e) => ({
          userId,
          year,
          month,
          day:          e.day,
          engagementId: e.engagementId!,
          hours:        e.hours,
          notes:        e.notes ?? null,
        })),
      )
    }

    // Crea il record mese in 'draft' se non esiste ancora
    await db
      .insert(timesheetExtraMonths)
      .values({ userId, year, month, status: 'draft' })
      .onConflictDoUpdate({
        target: [timesheetExtraMonths.userId, timesheetExtraMonths.year, timesheetExtraMonths.month],
        set: { updatedAt: new Date() },
      })

    revalidatePath(`/timesheet-extra/${year}/${month}`)
    revalidatePath('/timesheet-extra')
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('saveTimesheetExtraEntries error:', err)
    return { ok: false, error: 'Errore del server. Riprova.' }
  }
}

// ─── Invio definitivo ─────────────────────────────────────────────────────────

export async function submitTimesheetExtra(
  year:  number,
  month: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'TIMESHEET_EXTRA')
    const userId = session.user.id

    if (isFutureMonth(year, month)) {
      return { ok: false, error: 'Non puoi inviare mesi futuri.' }
    }

    const now = new Date()

    const existing = await db
      .select({ id: timesheetExtraMonths.id, status: timesheetExtraMonths.status })
      .from(timesheetExtraMonths)
      .where(
        and(
          eq(timesheetExtraMonths.userId, userId),
          eq(timesheetExtraMonths.year,   year),
          eq(timesheetExtraMonths.month,  month),
        ),
      )
      .limit(1)

    if (existing.length > 0 && existing[0].status !== 'draft') {
      return { ok: false, error: 'Il mese non è in bozza.' }
    }

    if (existing.length === 0) {
      await db.insert(timesheetExtraMonths).values({
        userId,
        year,
        month,
        status:     'approved',
        approvedAt: now,
      })
    } else {
      await db
        .update(timesheetExtraMonths)
        .set({ status: 'approved', approvedAt: now, updatedAt: now })
        .where(eq(timesheetExtraMonths.id, existing[0].id))
    }

    revalidatePath(`/timesheet-extra/${year}/${month}`)
    revalidatePath('/timesheet-extra')
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('submitTimesheetExtra error:', err)
    return { ok: false, error: 'Errore del server. Riprova.' }
  }
}
