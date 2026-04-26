'use server'

import { and, asc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { auth } from '@/auth'
import { db } from '@/db'
import { clients, engagements, engagementUsers, projects, users } from '@/db/schema'
import { requireSection } from '@/lib/permissions/auth-helpers'

// Alias per distinguere utente assegnato e responsabile (stessa tabella)
const assignedUser     = alias(users, 'assigned_user')
const responsibleUser  = alias(users, 'responsible_user')

// ─── Tipi ────────────────────────────────────────────────────────────────────

export type CommessaUtenteRow = {
  userId:          string
  userName:        string   // "Cognome Nome"
  engagementId:    string
  engagementCode:  string
  engagementName:  string
  engagementActive: boolean
  responsibleId:   string
  responsibleName: string   // "Cognome Nome"
}

export type FilterOption = { id: string; label: string }

export type ActiveFilter = 'all' | 'active' | 'inactive'

export type CommessaUtenteFilters = {
  userId:          string | null
  engagementId:    string | null
  responsibleId:   string | null
  activeOnly:      ActiveFilter
}

// ─── Dati report ─────────────────────────────────────────────────────────────

export async function getCommessePerUtente(
  filters: CommessaUtenteFilters,
): Promise<CommessaUtenteRow[]> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')

  const conditions = [
    filters.userId        ? eq(engagementUsers.userId,       filters.userId)        : undefined,
    filters.engagementId  ? eq(engagementUsers.engagementId, filters.engagementId)  : undefined,
    filters.responsibleId ? eq(projects.responsibleUserId,   filters.responsibleId) : undefined,
    filters.activeOnly === 'active'   ? eq(engagements.active, true)  : undefined,
    filters.activeOnly === 'inactive' ? eq(engagements.active, false) : undefined,
  ].filter(Boolean) as ReturnType<typeof eq>[]

  const rows = await db
    .select({
      userId:           engagementUsers.userId,
      userLastName:     assignedUser.lastName,
      userFirstName:    assignedUser.firstName,
      engagementId:     engagements.id,
      clientCode:       clients.code,
      projectCode:      projects.code,
      engagementCode:   engagements.code,
      engagementName:   engagements.name,
      engagementActive: engagements.active,
      responsibleId:    projects.responsibleUserId,
      responsibleLast:  responsibleUser.lastName,
      responsibleFirst: responsibleUser.firstName,
    })
    .from(engagementUsers)
    .innerJoin(assignedUser,    eq(assignedUser.id,    engagementUsers.userId))
    .innerJoin(engagements,     eq(engagements.id,     engagementUsers.engagementId))
    .innerJoin(projects,        eq(projects.id,        engagements.projectId))
    .innerJoin(clients,         eq(clients.id,         projects.clientId))
    .innerJoin(responsibleUser, eq(responsibleUser.id, projects.responsibleUserId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      asc(assignedUser.lastName),
      asc(assignedUser.firstName),
      asc(engagements.name),
    )

  return rows.map((r) => ({
    userId:           r.userId,
    userName:         `${r.userLastName} ${r.userFirstName}`,
    engagementId:     r.engagementId,
    engagementCode:   `${r.clientCode}-${r.projectCode}-${r.engagementCode}`,
    engagementName:   r.engagementName,
    engagementActive: r.engagementActive,
    responsibleId:    r.responsibleId,
    responsibleName:  `${r.responsibleLast} ${r.responsibleFirst}`,
  }))
}

// ─── Filtri dropdown ─────────────────────────────────────────────────────────

/** Tutti gli utenti che hanno almeno una commessa assegnata */
export async function getFilterUsers(): Promise<FilterOption[]> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')

  const rows = await db
    .selectDistinct({
      id:        users.id,
      lastName:  users.lastName,
      firstName: users.firstName,
    })
    .from(engagementUsers)
    .innerJoin(users, eq(users.id, engagementUsers.userId))
    .orderBy(asc(users.lastName), asc(users.firstName))

  return rows.map((r) => ({ id: r.id, label: `${r.lastName} ${r.firstName}` }))
}

/** Tutte le commesse */
export async function getFilterEngagements(): Promise<FilterOption[]> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')

  const rows = await db
    .select({
      id:   engagements.id,
      code: engagements.code,
      name: engagements.name,
    })
    .from(engagements)
    .orderBy(asc(engagements.name))

  return rows.map((r) => ({ id: r.id, label: `${r.code} — ${r.name}` }))
}

/** Tutti gli utenti responsabili di almeno un progetto */
export async function getFilterResponsibili(): Promise<FilterOption[]> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')

  const rows = await db
    .selectDistinct({
      id:        users.id,
      lastName:  users.lastName,
      firstName: users.firstName,
    })
    .from(projects)
    .innerJoin(users, eq(users.id, projects.responsibleUserId))
    .orderBy(asc(users.lastName), asc(users.firstName))

  return rows.map((r) => ({ id: r.id, label: `${r.lastName} ${r.firstName}` }))
}
