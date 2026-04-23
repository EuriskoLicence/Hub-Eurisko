'use server'

import { and, asc, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { clients, engagements, projects, users } from '@/db/schema'
import { requireSection } from '@/lib/permissions/auth-helpers'

// ─── Tipi ────────────────────────────────────────────────────────────────────

export type CommessaRow = {
  clientCode:      string
  clientName:      string
  projectCode:     string
  projectName:     string
  responsibleName: string
  engagementCode:  string
  engagementName:  string
  active:          boolean
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
  if (filters.clientId)               conditions.push(eq(projects.clientId, filters.clientId))
  if (filters.projectId)              conditions.push(eq(engagements.projectId, filters.projectId))
  if (filters.activeOnly === 'active')   conditions.push(eq(engagements.active, true))
  if (filters.activeOnly === 'inactive') conditions.push(eq(engagements.active, false))

  const rows = await db
    .select({
      clientCode:       clients.code,
      clientName:       clients.name,
      projectCode:      projects.code,
      projectName:      projects.name,
      responsibleLast:  users.lastName,
      responsibleFirst: users.firstName,
      engagementCode:   engagements.code,
      engagementName:   engagements.name,
      active:           engagements.active,
    })
    .from(engagements)
    .innerJoin(projects, eq(engagements.projectId, projects.id))
    .innerJoin(clients,  eq(projects.clientId, clients.id))
    .innerJoin(users,    eq(projects.responsibleUserId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      asc(clients.name),
      asc(projects.name),
      asc(engagements.code),
    )

  return rows.map((r) => ({
    clientCode:      r.clientCode,
    clientName:      r.clientName,
    projectCode:     r.projectCode,
    projectName:     r.projectName,
    responsibleName: `${r.responsibleLast} ${r.responsibleFirst}`,
    engagementCode:  r.engagementCode,
    engagementName:  r.engagementName,
    active:          r.active,
  }))
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
