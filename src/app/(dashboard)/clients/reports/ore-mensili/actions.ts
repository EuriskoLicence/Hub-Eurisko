'use server'

import { and, eq, sql } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  timesheetEntries, timesheetExtraEntries,
  engagements, projects, clients, users,
} from '@/db/schema'
import { requireSection } from '@/lib/permissions/auth-helpers'

// ─── Tipi ─────────────────────────────────────────────────────────────────────

/** Colonna mese del report. `key` = "YYYY-MM", `label` = "Gen 2026". */
export type MonthCol = {
  key:   string
  year:  number
  month: number
  label: string
}

export type MonthlyHoursRow = {
  clientName:         string
  clientCode:         string
  projectName:        string
  projectCode:        string
  projectManagerName: string
  engagementId:       string
  engagementName:     string
  engagementCode:     string
  compositeCode:      string
  userId:             string
  userName:           string
  hoursByMonth:       Record<string, number>  // solo i mesi valorizzati
  totalHours:         number
}

export type MonthlyHoursFilters = {
  fromYear:      number
  fromMonth:     number
  toYear:        number
  toMonth:       number
  responsibleId: string | null
  clientId:      string | null
  projectId:     string | null
  engagementId:  string | null
  userId:        string | null
}

export type MonthlyHoursReport = {
  months:      MonthCol[]              // solo mesi con almeno 1 ora, ordinati cronologicamente
  rows:        MonthlyHoursRow[]
  monthTotals: Record<string, number>  // totale per colonna
  grandTotal:  number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IT_MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu',
                         'Lug','Ago','Set','Ott','Nov','Dic']

/** Chiave colonna mese: "YYYY-MM" (zero-padded, ordinabile lessicograficamente). */
function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Ordinale mese assoluto, per confronti di range su (anno, mese). */
function monthOrdinal(year: number, month: number): number {
  return year * 12 + month
}

// ─── Query principale ─────────────────────────────────────────────────────────

/**
 * Ore consuntivate (ordinarie + extra sommate) per commessa × utente,
 * distribuite sui mesi del range richiesto.
 * Le assenze sono escluse automaticamente dall'innerJoin su `engagements`
 * (le entry di assenza hanno `engagementId` NULL).
 */
export async function getMonthlyHoursReport(
  filters: MonthlyHoursFilters,
): Promise<MonthlyHoursReport> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')

  const { responsibleId, clientId, projectId, engagementId, userId } = filters

  // Normalizza il range se invertito (evita risultati vuoti silenziosi)
  let fromOrd = monthOrdinal(filters.fromYear, filters.fromMonth)
  let toOrd   = monthOrdinal(filters.toYear,   filters.toMonth)
  if (fromOrd > toOrd) [fromOrd, toOrd] = [toOrd, fromOrd]

  const standardConditions = [
    sql`(${timesheetEntries.year} * 12 + ${timesheetEntries.month}) BETWEEN ${fromOrd} AND ${toOrd}`,
  ]
  const extraConditions = [
    sql`(${timesheetExtraEntries.year} * 12 + ${timesheetExtraEntries.month}) BETWEEN ${fromOrd} AND ${toOrd}`,
  ]

  if (responsibleId) { standardConditions.push(eq(projects.responsibleUserId, responsibleId)); extraConditions.push(eq(projects.responsibleUserId, responsibleId)) }
  if (clientId)      { standardConditions.push(eq(clients.id,                 clientId));      extraConditions.push(eq(clients.id,                 clientId))      }
  if (projectId)     { standardConditions.push(eq(projects.id,                projectId));     extraConditions.push(eq(projects.id,                projectId))     }
  if (engagementId)  { standardConditions.push(eq(engagements.id,             engagementId));  extraConditions.push(eq(engagements.id,             engagementId))  }
  if (userId)        { standardConditions.push(eq(timesheetEntries.userId,    userId));        extraConditions.push(eq(timesheetExtraEntries.userId, userId))      }

  // Ore ordinarie, aggregate per commessa × utente × mese
  const standardRows = await db
    .select({
      clientId:         clients.id,
      clientName:       clients.name,
      clientCode:       clients.code,
      projectId:        projects.id,
      projectName:      projects.name,
      projectCode:      projects.code,
      projectManagerId: projects.responsibleUserId,
      engagementId:     engagements.id,
      engagementName:   engagements.name,
      engagementCode:   engagements.code,
      userId:           timesheetEntries.userId,
      year:             timesheetEntries.year,
      month:            timesheetEntries.month,
      hours:            sql<number>`sum(${timesheetEntries.hours})`.as('hours'),
    })
    .from(timesheetEntries)
    .innerJoin(engagements, eq(timesheetEntries.engagementId, engagements.id))
    .innerJoin(projects,    eq(engagements.projectId,         projects.id))
    .innerJoin(clients,     eq(projects.clientId,             clients.id))
    .where(and(...standardConditions))
    .groupBy(
      clients.id, clients.name, clients.code,
      projects.id, projects.name, projects.code, projects.responsibleUserId,
      engagements.id, engagements.name, engagements.code,
      timesheetEntries.userId, timesheetEntries.year, timesheetEntries.month,
    )

  // Ore extra, stessa aggregazione
  const extraRows = await db
    .select({
      clientId:         clients.id,
      clientName:       clients.name,
      clientCode:       clients.code,
      projectId:        projects.id,
      projectName:      projects.name,
      projectCode:      projects.code,
      projectManagerId: projects.responsibleUserId,
      engagementId:     engagements.id,
      engagementName:   engagements.name,
      engagementCode:   engagements.code,
      userId:           timesheetExtraEntries.userId,
      year:             timesheetExtraEntries.year,
      month:            timesheetExtraEntries.month,
      hours:            sql<number>`sum(${timesheetExtraEntries.hours})`.as('hours'),
    })
    .from(timesheetExtraEntries)
    .innerJoin(engagements, eq(timesheetExtraEntries.engagementId, engagements.id))
    .innerJoin(projects,    eq(engagements.projectId,              projects.id))
    .innerJoin(clients,     eq(projects.clientId,                  clients.id))
    .where(and(...extraConditions))
    .groupBy(
      clients.id, clients.name, clients.code,
      projects.id, projects.name, projects.code, projects.responsibleUserId,
      engagements.id, engagements.name, engagements.code,
      timesheetExtraEntries.userId, timesheetExtraEntries.year, timesheetExtraEntries.month,
    )

  // Nomi utente (usati sia per le righe sia per il responsabile progetto)
  const allUsers = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
  const userNameMap = new Map(allUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]))

  // ── Merge: ordinarie ed extra confluiscono nella stessa cella ──
  type RowAccum = Omit<MonthlyHoursRow, 'totalHours'>

  const rowMap      = new Map<string, RowAccum>()
  const monthTotals = new Map<string, number>()
  const monthsSeen  = new Map<string, MonthCol>()

  function accumulate(r: (typeof standardRows)[number]) {
    const rowKey = `${r.engagementId}|${r.userId}`
    if (!rowMap.has(rowKey)) {
      rowMap.set(rowKey, {
        clientName:         r.clientName,
        clientCode:         r.clientCode,
        projectName:        r.projectName,
        projectCode:        r.projectCode,
        projectManagerName: userNameMap.get(r.projectManagerId ?? '') ?? '',
        engagementId:       r.engagementId,
        engagementName:     r.engagementName,
        engagementCode:     r.engagementCode,
        compositeCode:      `${r.clientCode}-${r.projectCode}-${r.engagementCode}`,
        userId:             r.userId,
        userName:           userNameMap.get(r.userId) ?? r.userId,
        hoursByMonth:       {},
      })
    }

    const key   = monthKey(r.year, r.month)
    const hours = Number(r.hours)
    const row   = rowMap.get(rowKey)!

    row.hoursByMonth[key] = (row.hoursByMonth[key] ?? 0) + hours
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + hours)

    if (!monthsSeen.has(key)) {
      monthsSeen.set(key, {
        key,
        year:  r.year,
        month: r.month,
        label: `${IT_MONTHS_SHORT[r.month - 1]} ${r.year}`,
      })
    }
  }

  for (const r of standardRows) accumulate(r)
  for (const r of extraRows)    accumulate(r)

  // Colonne: solo mesi con almeno 1 ora, in ordine cronologico
  const months = Array.from(monthsSeen.values())
    .filter((m) => (monthTotals.get(m.key) ?? 0) !== 0)
    .sort((a, b) => monthOrdinal(a.year, a.month) - monthOrdinal(b.year, b.month))

  const rows: MonthlyHoursRow[] = Array.from(rowMap.values())
    .map((r) => ({
      ...r,
      totalHours: Object.values(r.hoursByMonth).reduce((s, h) => s + h, 0),
    }))
    .sort((a, b) =>
      a.clientName.localeCompare(b.clientName) ||
      a.projectName.localeCompare(b.projectName) ||
      a.engagementName.localeCompare(b.engagementName) ||
      a.userName.localeCompare(b.userName)
    )

  return {
    months,
    rows,
    monthTotals: Object.fromEntries(monthTotals),
    grandTotal:  rows.reduce((s, r) => s + r.totalHours, 0),
  }
}
