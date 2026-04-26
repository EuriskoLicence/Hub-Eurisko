'use server'

import { and, asc, eq, gte, isNotNull, lt, sql } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  clients,
  engagements,
  projects,
  users,
  timesheetEntries,
  timesheetMonths,
  timesheetExtraEntries,
  timesheetExtraMonths,
} from '@/db/schema'
import { requireSection } from '@/lib/permissions/auth-helpers'

// Valore sentinella usato in DB quando non è impostato un budget ore
const UNLIMITED_HOURS = 999999

// ─── Tipi ────────────────────────────────────────────────────────────────────

export type CommessaRow = {
  engagementId:    string
  clientCode:      string
  clientName:      string
  projectCode:     string
  projectName:     string
  responsibleName: string
  engagementCode:  string
  engagementName:  string
  validUntil:      string         // YYYY-MM-DD
  active:          boolean        // derivato: validUntil >= oggi
  totalHours:      number | null  // null = nessun limite (999999 in DB)
  workedHours:     number         // somma approvata da timesheet + extra
  remainingHours:  number | null  // null se totalHours è null
}

export type ActiveFilter = 'all' | 'active' | 'inactive'

export type CommessaFilters = {
  clientId:   string | null
  projectId:  string | null
  activeOnly: ActiveFilter
}

export type FilterOption = { id: string; label: string }

// ─── Dati report ─────────────────────────────────────────────────────────────

export async function getCommessaList(filters: CommessaFilters): Promise<CommessaRow[]> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')

  const conditions: ReturnType<typeof eq>[] = []
  if (filters.clientId)                conditions.push(eq(projects.clientId,   filters.clientId))
  if (filters.projectId)               conditions.push(eq(engagements.projectId, filters.projectId))
  if (filters.activeOnly === 'active')   conditions.push(gte(engagements.validUntil, sql`CURRENT_DATE`))
  if (filters.activeOnly === 'inactive') conditions.push(lt(engagements.validUntil,  sql`CURRENT_DATE`))

  // Query principale
  const [mainRows, tsHoursRows, extraHoursRows] = await Promise.all([
    db
      .select({
        engagementId:     engagements.id,
        clientCode:       clients.code,
        clientName:       clients.name,
        projectCode:      projects.code,
        projectName:      projects.name,
        responsibleLast:  users.lastName,
        responsibleFirst: users.firstName,
        engagementCode:   engagements.code,
        engagementName:   engagements.name,
        validUntil:       engagements.validUntil,
        totalHours:       engagements.totalHours,
      })
      .from(engagements)
      .innerJoin(projects, eq(engagements.projectId,        projects.id))
      .innerJoin(clients,  eq(projects.clientId,            clients.id))
      .innerJoin(users,    eq(projects.responsibleUserId,   users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(clients.name), asc(projects.name), asc(engagements.code)),

    // Ore timesheet ordinario approvate per commessa
    db
      .select({
        engagementId: timesheetEntries.engagementId,
        hours:        sql<number>`coalesce(sum(${timesheetEntries.hours}), 0)`.as('hours'),
      })
      .from(timesheetEntries)
      .innerJoin(
        timesheetMonths,
        and(
          eq(timesheetMonths.userId, timesheetEntries.userId),
          eq(timesheetMonths.year,   timesheetEntries.year),
          eq(timesheetMonths.month,  timesheetEntries.month),
        ),
      )
      .where(
        and(
          isNotNull(timesheetEntries.engagementId),
          eq(timesheetMonths.status, 'approved'),
        ),
      )
      .groupBy(timesheetEntries.engagementId),

    // Ore timesheet extra approvate per commessa
    db
      .select({
        engagementId: timesheetExtraEntries.engagementId,
        hours:        sql<number>`coalesce(sum(${timesheetExtraEntries.hours}), 0)`.as('hours'),
      })
      .from(timesheetExtraEntries)
      .innerJoin(
        timesheetExtraMonths,
        and(
          eq(timesheetExtraMonths.userId, timesheetExtraEntries.userId),
          eq(timesheetExtraMonths.year,   timesheetExtraEntries.year),
          eq(timesheetExtraMonths.month,  timesheetExtraEntries.month),
        ),
      )
      .where(
        and(
          isNotNull(timesheetExtraEntries.engagementId),
          eq(timesheetExtraMonths.status, 'approved'),
        ),
      )
      .groupBy(timesheetExtraEntries.engagementId),
  ])

  const tsMap    = new Map(tsHoursRows.map((r)    => [r.engagementId, Number(r.hours)]))
  const extraMap = new Map(extraHoursRows.map((r) => [r.engagementId, Number(r.hours)]))

  return mainRows.map((r) => {
    const workedHours    = (tsMap.get(r.engagementId) ?? 0) + (extraMap.get(r.engagementId) ?? 0)
    const budgetHours    = r.totalHours >= UNLIMITED_HOURS ? null : r.totalHours
    const remainingHours = budgetHours === null ? null : budgetHours - workedHours

    return {
      engagementId:    r.engagementId,
      clientCode:      r.clientCode,
      clientName:      r.clientName,
      projectCode:     r.projectCode,
      projectName:     r.projectName,
      responsibleName: `${r.responsibleLast} ${r.responsibleFirst}`,
      engagementCode:  r.engagementCode,
      engagementName:  r.engagementName,
      validUntil:      r.validUntil,
      active:          r.validUntil >= new Date().toISOString().split('T')[0],
      totalHours:      budgetHours,
      workedHours,
      remainingHours,
    }
  })
}

// ─── Filtri dropdown ─────────────────────────────────────────────────────────

export async function getFilterClients(): Promise<FilterOption[]> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')

  const rows = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .orderBy(clients.name)

  return rows.map((r) => ({ id: r.id, label: r.name }))
}

export async function getFilterProjects(clientId?: string | null): Promise<FilterOption[]> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')

  const conditions: ReturnType<typeof eq>[] = []
  if (clientId) conditions.push(eq(projects.clientId, clientId))

  const rows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(projects.name)

  return rows.map((r) => ({ id: r.id, label: r.name }))
}
