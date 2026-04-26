'use server'

import { revalidatePath } from 'next/cache'
import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  timesheetExtraEntries,
  timesheetExtraMonths,
  engagementUsers,
  engagements,
  projects,
  clients,
  users,
} from '@/db/schema'
import { requireSection, HttpError } from '@/lib/permissions/auth-helpers'
import { getMonthCalendar } from '@/lib/italian-calendar'
import { checkEngagementBudgets } from '@/lib/engagement-budget'
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

// ─── Check autorizzazione ─────────────────────────────────────────────────────
// Verifica che loggedUserId sia responsabile di almeno un progetto
// che contiene una commessa a cui targetUserId è abilitato.

async function assertResponsibleFor(loggedUserId: string, targetUserId: string) {
  const rows = await db
    .selectDistinct({ id: engagementUsers.userId })
    .from(engagementUsers)
    .innerJoin(engagements, eq(engagementUsers.engagementId, engagements.id))
    .innerJoin(projects,    eq(engagements.projectId,        projects.id))
    .where(
      and(
        eq(projects.responsibleUserId, loggedUserId),
        eq(engagementUsers.userId,     targetUserId),
        gte(engagements.validUntil,    sql`CURRENT_DATE`),
        eq(projects.active,            true),
      ),
    )
    .limit(1)

  if (rows.length === 0) {
    throw new HttpError(403, 'Non hai il permesso di gestire la consuntivazione extra di questo utente.')
  }
}

// ─── Lista utenti gestibili (usata dalla user picker page) ───────────────────

export async function getManagedUsers(): Promise<{ id: string; firstName: string; lastName: string }[]> {
  const session = await auth()
  requireSection(session, 'TIMESHEET_EXTRA')
  const loggedUserId = session.user.id

  const rows = await db
    .selectDistinct({
      id:        users.id,
      firstName: users.firstName,
      lastName:  users.lastName,
    })
    .from(engagementUsers)
    .innerJoin(engagements, eq(engagementUsers.engagementId, engagements.id))
    .innerJoin(projects,    eq(engagements.projectId,        projects.id))
    .innerJoin(users,       eq(engagementUsers.userId,       users.id))
    .where(
      and(
        eq(projects.responsibleUserId, loggedUserId),
        gte(engagements.validUntil,    sql`CURRENT_DATE`),
        eq(projects.active,            true),
      ),
    )
    .orderBy(asc(users.lastName), asc(users.firstName))

  return rows
}

// ─── Griglia annuale per utente ───────────────────────────────────────────────

export async function getTimesheetExtraYearDataForUser(targetUserId: string, year: number) {
  const session = await auth()
  requireSection(session, 'TIMESHEET_EXTRA')
  await assertResponsibleFor(session.user.id, targetUserId)

  // Nome utente target
  const userRow = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1)
  const targetUserName = userRow[0]
    ? `${userRow[0].firstName} ${userRow[0].lastName}`
    : 'Utente'

  const now      = new Date()
  const curYear  = now.getFullYear()
  const curMonth = now.getMonth() + 1

  const statusRows = await db
    .select()
    .from(timesheetExtraMonths)
    .where(and(eq(timesheetExtraMonths.userId, targetUserId), eq(timesheetExtraMonths.year, year)))

  const statusMap = new Map(statusRows.map((r) => [r.month, r]))

  const entryRows = await db
    .select()
    .from(timesheetExtraEntries)
    .where(and(eq(timesheetExtraEntries.userId, targetUserId), eq(timesheetExtraEntries.year, year)))

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
      status:      (status?.status ?? 'not_started') as 'not_started' | 'draft' | 'approved',
      totalHours:  hoursMap.get(month) ?? 0,
      isCurrent:   year === curYear && month === curMonth,
      isFuture,
    }
  })

  const submitted = months.filter((m) => m.status === 'approved').length
  const draft     = months.filter((m) => m.status === 'draft').length
  const notOpened = months.filter((m) => m.status === 'not_started').length

  return { months, summary: { submitted, draft, notOpened }, currentYear: curYear, targetUserName }
}

// ─── Caricamento dati pagina mese per utente ──────────────────────────────────

export type TimesheetExtraPageDataForUser = TimesheetPageData & { targetUserName: string }

export async function getTimesheetExtraPageDataForUser(
  targetUserId: string,
  year:  number,
  month: number,
): Promise<TimesheetExtraPageDataForUser> {
  const session = await auth()
  requireSection(session, 'TIMESHEET_EXTRA')
  await assertResponsibleFor(session.user.id, targetUserId)

  // Nome utente target
  const userRow = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1)
  const targetUserName = userRow[0]
    ? `${userRow[0].firstName} ${userRow[0].lastName}`
    : 'Utente'

  // Stato mese
  const monthRows = await db
    .select()
    .from(timesheetExtraMonths)
    .where(
      and(
        eq(timesheetExtraMonths.userId, targetUserId),
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

  // Entries del mese (di targetUserId)
  const entryRows = await db
    .select()
    .from(timesheetExtraEntries)
    .where(
      and(
        eq(timesheetExtraEntries.userId, targetUserId),
        eq(timesheetExtraEntries.year,   year),
        eq(timesheetExtraEntries.month,  month),
      ),
    )

  const entryRecords = entryRows.map((r) => ({
    id:            r.id,
    day:           r.day,
    engagementId:  r.engagementId  ?? null,
    absenceTypeId: null,
    hours:         r.hours,
    notes:         r.notes ?? null,
  }))

  // Commesse di targetUserId per le quali il manager è responsabile
  // (solo attive — usate nel dropdown "aggiungi commessa")
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
        eq(engagementUsers.userId,     targetUserId),
        eq(projects.responsibleUserId, session.user.id),
        eq(projects.active,            true),
        eq(clients.active,             true),
        gte(engagements.validUntil,    sql`CURRENT_DATE`),
      ),
    )

  // Recupera anche le commesse inattive referenziate dalle entry esistenti
  // (per mostrare il nome corretto invece di "Commessa sconosciuta")
  const activeEngIds  = new Set(engRows.map((e) => e.id))
  const missingEngIds = Array.from(
    new Set(
      entryRows
        .map((r) => r.engagementId)
        .filter((id): id is string => id !== null && !activeEngIds.has(id)),
    ),
  )

  if (missingEngIds.length > 0) {
    const inactiveEngRows = await db
      .select({
        id:          engagements.id,
        name:        engagements.name,
        code:        engagements.code,
        projectName: projects.name,
        clientName:  clients.name,
      })
      .from(engagements)
      .innerJoin(projects, eq(engagements.projectId, projects.id))
      .innerJoin(clients,  eq(projects.clientId,     clients.id))
      .where(inArray(engagements.id, missingEngIds))

    engRows.push(...inactiveEngRows)
  }

  // Calendario
  const calDays = await getMonthCalendar(year, month)
  const calendar: CalendarDaySerialized[] = calDays.map((d) => ({
    isoDate:      d.isoDate,
    dayOfMonth:   d.date.getUTCDate(),
    dayOfWeek:    d.dayOfWeek,
    dayAbbr:      IT_DAY_ABBR[d.dayOfWeek],
    isWeekend:    d.isWeekend,
    isHoliday:    d.isHoliday,
    holidayName:  d.holidayName,
    isWorkingDay: d.isWorkingDay,
  }))

  return {
    year,
    month,
    isFuture:      isFutureMonth(year, month),
    monthStatus,
    entries:       entryRecords,
    engagements:   engRows,
    absences:      [],
    calendar,
    targetUserName,
  }
}

// ─── Salvataggio bozza per utente ─────────────────────────────────────────────

export async function saveTimesheetExtraEntriesForUser(
  targetUserId: string,
  year:         number,
  month:        number,
  entries:      SaveEntry[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'TIMESHEET_EXTRA')
    await assertResponsibleFor(session.user.id, targetUserId)

    if (isFutureMonth(year, month)) {
      return { ok: false, error: 'Non puoi modificare mesi futuri.' }
    }

    const monthRow = await db
      .select({ status: timesheetExtraMonths.status })
      .from(timesheetExtraMonths)
      .where(
        and(
          eq(timesheetExtraMonths.userId, targetUserId),
          eq(timesheetExtraMonths.year,   year),
          eq(timesheetExtraMonths.month,  month),
        ),
      )
      .limit(1)

    const currentStatus = monthRow[0]?.status ?? 'draft'
    if (currentStatus !== 'draft') {
      return { ok: false, error: 'Il mese non è in bozza: non puoi modificare le ore.' }
    }

    // Commesse abilitate per targetUserId sulle quali il manager è responsabile
    const allowedEngRows = await db
      .select({ engagementId: engagementUsers.engagementId })
      .from(engagementUsers)
      .innerJoin(engagements, eq(engagementUsers.engagementId, engagements.id))
      .innerJoin(projects,    eq(engagements.projectId,        projects.id))
      .where(
        and(
          eq(engagementUsers.userId,     targetUserId),
          eq(projects.responsibleUserId, session.user.id),
          eq(projects.active,            true),
          gte(engagements.validUntil,    sql`CURRENT_DATE`),
        ),
      )

    const allowedEngIds = new Set(allowedEngRows.map((r) => r.engagementId))

    // Validazione entries (le ore possono essere negative per giroconti)
    const dayTotals = new Map<number, number>()
    for (const e of entries) {
      if (e.hours < -24 || e.hours > 24 || e.hours === 0 || !Number.isInteger(e.hours)) {
        return { ok: false, error: `Le ore devono essere un intero non nullo tra -24 e 24 (giorno ${e.day}).` }
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
      if (total < -24) {
        return { ok: false, error: `Il giorno ${day} scende sotto le -24 ore totali (${total}h inserite).` }
      }
    }

    // Controllo budget ore (solo commesse con ore nette positive)
    const newHoursMap: Record<string, number> = {}
    for (const e of entries) {
      if (e.engagementId) {
        newHoursMap[e.engagementId] = (newHoursMap[e.engagementId] ?? 0) + e.hours
      }
    }
    const positiveHoursMap = Object.fromEntries(
      Object.entries(newHoursMap).filter(([, h]) => h > 0),
    )
    const budgetCheck = await checkEngagementBudgets({
      newHours:     positiveHoursMap,
      excludeExtra: { userId: targetUserId, year, month },
    })
    if (!budgetCheck.ok) return budgetCheck

    // Salva: delete + insert
    await db
      .delete(timesheetExtraEntries)
      .where(
        and(
          eq(timesheetExtraEntries.userId, targetUserId),
          eq(timesheetExtraEntries.year,   year),
          eq(timesheetExtraEntries.month,  month),
        ),
      )

    if (entries.length > 0) {
      await db.insert(timesheetExtraEntries).values(
        entries.map((e) => ({
          userId:       targetUserId,
          year,
          month,
          day:          e.day,
          engagementId: e.engagementId!,
          hours:        e.hours,
          notes:        e.notes ?? null,
        })),
      )
    }

    // Crea/aggiorna record mese
    await db
      .insert(timesheetExtraMonths)
      .values({ userId: targetUserId, year, month, status: 'draft' })
      .onConflictDoUpdate({
        target: [timesheetExtraMonths.userId, timesheetExtraMonths.year, timesheetExtraMonths.month],
        set:    { updatedAt: new Date() },
      })

    revalidatePath(`/timesheet-extra/${targetUserId}/${year}/${month}`)
    revalidatePath(`/timesheet-extra/${targetUserId}`)
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('saveTimesheetExtraEntriesForUser error:', err)
    return { ok: false, error: 'Errore del server. Riprova.' }
  }
}

// ─── Invio definitivo per utente ──────────────────────────────────────────────

export async function submitTimesheetExtraForUser(
  targetUserId: string,
  year:  number,
  month: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'TIMESHEET_EXTRA')
    await assertResponsibleFor(session.user.id, targetUserId)

    if (isFutureMonth(year, month)) {
      return { ok: false, error: 'Non puoi inviare mesi futuri.' }
    }

    const now = new Date()

    const existing = await db
      .select({ id: timesheetExtraMonths.id, status: timesheetExtraMonths.status })
      .from(timesheetExtraMonths)
      .where(
        and(
          eq(timesheetExtraMonths.userId, targetUserId),
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
        userId:     targetUserId,
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

    revalidatePath(`/timesheet-extra/${targetUserId}/${year}/${month}`)
    revalidatePath(`/timesheet-extra/${targetUserId}`)
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('submitTimesheetExtraForUser error:', err)
    return { ok: false, error: 'Errore del server. Riprova.' }
  }
}

// ─── Riapertura per utente ────────────────────────────────────────────────────

export async function reopenTimesheetExtraForUser(
  targetUserId: string,
  year:  number,
  month: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'TIMESHEET_EXTRA')
    await assertResponsibleFor(session.user.id, targetUserId)

    if (isFutureMonth(year, month)) {
      return { ok: false, error: 'Non puoi riaprire mesi futuri.' }
    }

    const existing = await db
      .select({ id: timesheetExtraMonths.id, status: timesheetExtraMonths.status })
      .from(timesheetExtraMonths)
      .where(
        and(
          eq(timesheetExtraMonths.userId, targetUserId),
          eq(timesheetExtraMonths.year,   year),
          eq(timesheetExtraMonths.month,  month),
        ),
      )
      .limit(1)

    if (existing.length === 0 || existing[0].status !== 'approved') {
      return { ok: false, error: 'Il mese non è in stato approvato: non può essere riaperto.' }
    }

    await db
      .update(timesheetExtraMonths)
      .set({ status: 'draft', updatedAt: new Date() })
      .where(eq(timesheetExtraMonths.id, existing[0].id))

    revalidatePath(`/timesheet-extra/${targetUserId}/${year}/${month}`)
    revalidatePath(`/timesheet-extra/${targetUserId}`)
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('reopenTimesheetExtraForUser error:', err)
    return { ok: false, error: 'Errore del server. Riprova.' }
  }
}
