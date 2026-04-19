'use server'

import { and, eq, sql, isNotNull } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  timesheetEntries, timesheetExtraEntries,
  engagements, projects, clients, users,
  roles, roleProfiles, profileSections,
} from '@/db/schema'
import { requireSection } from '@/lib/permissions/auth-helpers'

// ─── Tipi per i filtri ────────────────────────────────────────────────────────

export type FilterOption = { id: string; label: string }

export type ProjectManager = { id: string; fullName: string }

// ─── Funzioni per popolare i filtri ──────────────────────────────────────────

/** Clienti attivi, ordinati per nome. */
export async function getActiveClients(): Promise<FilterOption[]> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')

  const rows = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.active, true))
    .orderBy(clients.name)

  return rows.map((r) => ({ id: r.id, label: r.name }))
}

/** Progetti attivi, opzionalmente filtrati per cliente. */
export async function getActiveProjects(clientId?: string | null): Promise<FilterOption[]> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')

  const conditions = [eq(projects.active, true)]
  if (clientId) conditions.push(eq(projects.clientId, clientId))

  const rows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(...conditions))
    .orderBy(projects.name)

  return rows.map((r) => ({ id: r.id, label: r.name }))
}

/** Commesse attive, opzionalmente filtrate per progetto. */
export async function getActiveEngagements(projectId?: string | null): Promise<FilterOption[]> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')

  const conditions = [eq(engagements.active, true)]
  if (projectId) conditions.push(eq(engagements.projectId, projectId))

  const rows = await db
    .select({ id: engagements.id, name: engagements.name })
    .from(engagements)
    .where(and(...conditions))
    .orderBy(engagements.name)

  return rows.map((r) => ({ id: r.id, label: r.name }))
}

/** Utenti attivi con sezione TIMESHEET, ordinati per cognome. */
export async function getActiveTimesheetUsers(): Promise<FilterOption[]> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')

  const rows = await db
    .selectDistinct({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .innerJoin(roles,           eq(roles.id,           users.roleId))
    .innerJoin(roleProfiles,    eq(roleProfiles.roleId, roles.id))
    .innerJoin(profileSections, and(
      eq(profileSections.profileId,   roleProfiles.profileId),
      eq(profileSections.sectionCode, 'TIMESHEET'),
    ))
    .where(eq(users.active, true))
    .orderBy(users.lastName, users.firstName)

  return rows.map((r) => ({ id: r.id, label: `${r.firstName} ${r.lastName}` }))
}

/** Responsabili progetto (utenti responsabili di almeno un progetto). */
export async function getProjectManagers(): Promise<FilterOption[]> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')

  const rows = await db
    .selectDistinct({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(projects)
    .innerJoin(users, eq(users.id, projects.responsibleUserId))
    .where(isNotNull(projects.responsibleUserId))
    .orderBy(users.lastName, users.firstName)

  return rows.map((r) => ({ id: r.id, label: `${r.firstName} ${r.lastName}` }))
}

// ─── Tipi report ──────────────────────────────────────────────────────────────

export type ReportUser = {
  userId:        string
  userName:      string
  standardHours: number
  extraHours:    number
  totalHours:    number
}

export type ReportRow = {
  clientId:            string
  clientName:          string
  clientCode:          string
  projectId:           string
  projectName:         string
  projectCode:         string
  projectManagerId:    string
  projectManagerName:  string
  engagementId:        string
  engagementName:      string
  engagementCode:      string
  compositeCode:       string
  standardHours:       number
  extraHours:          number
  totalHours:          number
  users:               ReportUser[]
}

export type ReportFilters = {
  year:          number
  month:         number | null
  responsibleId: string | null
  clientId:      string | null
  projectId:     string | null
  engagementId:  string | null
  userId:        string | null
}

// ─── Query principale ─────────────────────────────────────────────────────────

export async function getHoursReport(filters: ReportFilters): Promise<ReportRow[]> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')

  const { year, month, responsibleId, clientId, projectId, engagementId, userId } = filters

  const standardConditions = month
    ? [eq(timesheetEntries.year, year), eq(timesheetEntries.month, month)]
    : [eq(timesheetEntries.year, year)]

  const extraConditions = month
    ? [eq(timesheetExtraEntries.year, year), eq(timesheetExtraEntries.month, month)]
    : [eq(timesheetExtraEntries.year, year)]

  if (responsibleId)  { standardConditions.push(eq(projects.responsibleUserId, responsibleId));  extraConditions.push(eq(projects.responsibleUserId, responsibleId)) }
  if (clientId)       { standardConditions.push(eq(clients.id,                 clientId));        extraConditions.push(eq(clients.id,                 clientId))      }
  if (projectId)      { standardConditions.push(eq(projects.id,                projectId));       extraConditions.push(eq(projects.id,                projectId))     }
  if (engagementId)   { standardConditions.push(eq(engagements.id,             engagementId));    extraConditions.push(eq(engagements.id,             engagementId))  }
  if (userId)         { standardConditions.push(eq(timesheetEntries.userId,     userId));          extraConditions.push(eq(timesheetExtraEntries.userId, userId))      }

  // Query ore standard
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
      timesheetEntries.userId,
    )

  // Query ore extra
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
      timesheetExtraEntries.userId,
    )

  // Carica nomi utenti
  const allUsers = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)

  const userNameMap = new Map(allUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]))

  // Struttura intermedia
  type UserAccum = { userId: string; userName: string; standardHours: number; extraHours: number }
  type EngAccum  = {
    clientId: string; clientName: string; clientCode: string
    projectId: string; projectName: string; projectCode: string; projectManagerId: string
    engagementId: string; engagementName: string; engagementCode: string
    users: Map<string, UserAccum>
  }

  const engMap = new Map<string, EngAccum>()

  function getOrCreate(r: Omit<EngAccum, 'users'>): EngAccum {
    if (!engMap.has(r.engagementId)) {
      engMap.set(r.engagementId, { ...r, users: new Map() })
    }
    return engMap.get(r.engagementId)!
  }

  for (const r of standardRows) {
    const eng = getOrCreate(r)
    if (!eng.users.has(r.userId)) {
      eng.users.set(r.userId, { userId: r.userId, userName: userNameMap.get(r.userId) ?? r.userId, standardHours: 0, extraHours: 0 })
    }
    eng.users.get(r.userId)!.standardHours += Number(r.hours)
  }

  for (const r of extraRows) {
    const eng = getOrCreate(r)
    if (!eng.users.has(r.userId)) {
      eng.users.set(r.userId, { userId: r.userId, userName: userNameMap.get(r.userId) ?? r.userId, standardHours: 0, extraHours: 0 })
    }
    eng.users.get(r.userId)!.extraHours += Number(r.hours)
  }

  return Array.from(engMap.values())
    .sort((a, b) =>
      a.clientName.localeCompare(b.clientName) ||
      a.projectName.localeCompare(b.projectName) ||
      a.engagementName.localeCompare(b.engagementName)
    )
    .map((eng) => {
      const userList: ReportUser[] = Array.from(eng.users.values())
        .sort((a, b) => a.userName.localeCompare(b.userName))
        .map((u) => ({
          userId:        u.userId,
          userName:      u.userName,
          standardHours: u.standardHours,
          extraHours:    u.extraHours,
          totalHours:    u.standardHours + u.extraHours,
        }))

      const standardHours = userList.reduce((s, u) => s + u.standardHours, 0)
      const extraHours    = userList.reduce((s, u) => s + u.extraHours,    0)

      return {
        clientId:           eng.clientId,
        clientName:         eng.clientName,
        clientCode:         eng.clientCode,
        projectId:          eng.projectId,
        projectName:        eng.projectName,
        projectCode:        eng.projectCode,
        projectManagerId:   eng.projectManagerId,
        projectManagerName: userNameMap.get(eng.projectManagerId) ?? '',
        engagementId:       eng.engagementId,
        engagementName:     eng.engagementName,
        engagementCode:     eng.engagementCode,
        compositeCode:      `${eng.clientCode}-${eng.projectCode}-${eng.engagementCode}`,
        standardHours,
        extraHours,
        totalHours: standardHours + extraHours,
        users: userList,
      }
    })
}
