'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, count, sql } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  clients, projects, engagements, engagementUsers,
  engagementTypes, users, roles, roleProfiles, profileSections,
} from '@/db/schema'
import { requireSection, hasSection, HttpError } from '@/lib/permissions/auth-helpers'
import { z } from 'zod'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClientSummary = {
  id:           string
  name:         string
  code:         string
  active:       boolean
  projectCount: number
}

export type ProjectSummary = {
  id:                string
  name:              string
  code:              string
  active:            boolean
  responsibleUserId: string | null
  responsibleName:   string | null
  engagementCount:   number
}

export type EngagementDetail = {
  id:               string
  name:             string
  code:             string
  active:           boolean
  totalHours:       number
  engagementTypeId: string
  engagementTypeName: string
  assignedUsers:    { userId: string; fullName: string; email: string }[]
}

export type ClientDetail = {
  id:       string
  name:     string
  code:     string
  active:   boolean
  projects: ProjectSummary[]
}

export type ProjectDetail = {
  id:                string
  name:              string
  code:              string
  active:            boolean
  clientId:          string
  clientName:        string
  responsibleUserId: string | null
  responsibleName:   string | null
  engagements:       EngagementDetail[]
}

export type EngagementTypeOption = { id: string; name: string }
export type UserOption           = { id: string; fullName: string; email: string }

// ─── Lettura ──────────────────────────────────────────────────────────────────

export async function getClientList(onlyActive = false): Promise<ClientSummary[]> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')

  const where = onlyActive ? eq(clients.active, true) : undefined

  const rows = await db
    .select({
      id:     clients.id,
      name:   clients.name,
      code:   clients.code,
      active: clients.active,
      projectCount: sql<number>`cast(count(${projects.id}) as int)`,
    })
    .from(clients)
    .leftJoin(projects, eq(projects.clientId, clients.id))
    .where(where)
    .groupBy(clients.id, clients.name, clients.code, clients.active)
    .orderBy(clients.name)

  return rows.map((r) => ({
    id:           r.id,
    name:         r.name,
    code:         r.code,
    active:       r.active,
    projectCount: Number(r.projectCount),
  }))
}

export async function getClientDetail(clientId: string): Promise<ClientDetail | null> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')

  const clientRow = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1)

  if (!clientRow.length) return null

  const projectRows = await db
    .select({
      id:                projects.id,
      name:              projects.name,
      code:              projects.code,
      active:            projects.active,
      responsibleUserId: projects.responsibleUserId,
      firstName:         users.firstName,
      lastName:          users.lastName,
      engCount:          sql<number>`cast(count(${engagements.id}) as int)`,
    })
    .from(projects)
    .leftJoin(users,       eq(users.id,       projects.responsibleUserId))
    .leftJoin(engagements, eq(engagements.projectId, projects.id))
    .where(eq(projects.clientId, clientId))
    .groupBy(projects.id, projects.name, projects.code, projects.active, projects.responsibleUserId, users.firstName, users.lastName)
    .orderBy(projects.name)

  return {
    id:     clientRow[0].id,
    name:   clientRow[0].name,
    code:   clientRow[0].code,
    active: clientRow[0].active,
    projects: projectRows.map((p) => ({
      id:                p.id,
      name:              p.name,
      code:              p.code,
      active:            p.active,
      responsibleUserId: p.responsibleUserId,
      responsibleName:   p.firstName ? `${p.firstName} ${p.lastName}` : null,
      engagementCount:   Number(p.engCount),
    })),
  }
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')

  const projectRow = await db
    .select({
      id:                projects.id,
      name:              projects.name,
      code:              projects.code,
      active:            projects.active,
      clientId:          projects.clientId,
      clientName:        clients.name,
      responsibleUserId: projects.responsibleUserId,
      responsibleFirst:  users.firstName,
      responsibleLast:   users.lastName,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .leftJoin(users, eq(users.id, projects.responsibleUserId))
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!projectRow.length) return null
  const p = projectRow[0]

  const engRows = await db
    .select({
      id:                 engagements.id,
      name:               engagements.name,
      code:               engagements.code,
      active:             engagements.active,
      totalHours:         engagements.totalHours,
      engagementTypeId:   engagements.engagementTypeId,
      engTypeName:        engagementTypes.name,
    })
    .from(engagements)
    .innerJoin(engagementTypes, eq(engagementTypes.id, engagements.engagementTypeId))
    .where(eq(engagements.projectId, projectId))
    .orderBy(engagements.name)

  // Assigned users per engagement
  const engagementIds = engRows.map((e) => e.id)
  const assignedRows = engagementIds.length > 0
    ? await db
        .select({
          engagementId: engagementUsers.engagementId,
          userId:       users.id,
          firstName:    users.firstName,
          lastName:     users.lastName,
          email:        users.email,
        })
        .from(engagementUsers)
        .innerJoin(users, eq(users.id, engagementUsers.userId))
        .where(sql`${engagementUsers.engagementId} = ANY(ARRAY[${sql.join(engagementIds.map((id) => sql`${id}::uuid`), sql`, `)}])`)
    : []

  const assignedByEng = new Map<string, { userId: string; fullName: string; email: string }[]>()
  for (const a of assignedRows) {
    if (!assignedByEng.has(a.engagementId)) assignedByEng.set(a.engagementId, [])
    assignedByEng.get(a.engagementId)!.push({
      userId:   a.userId,
      fullName: `${a.firstName} ${a.lastName}`,
      email:    a.email,
    })
  }

  return {
    id:                p.id,
    name:              p.name,
    code:              p.code,
    active:            p.active,
    clientId:          p.clientId,
    clientName:        p.clientName,
    responsibleUserId: p.responsibleUserId,
    responsibleName:   p.responsibleFirst ? `${p.responsibleFirst} ${p.responsibleLast}` : null,
    engagements: engRows.map((e) => ({
      id:                 e.id,
      name:               e.name,
      code:               e.code,
      active:             e.active,
      totalHours:         e.totalHours,
      engagementTypeId:   e.engagementTypeId,
      engagementTypeName: e.engTypeName,
      assignedUsers:      assignedByEng.get(e.id) ?? [],
    })),
  }
}

export async function getEngagementTypeOptions(): Promise<EngagementTypeOption[]> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')
  const rows = await db.select({ id: engagementTypes.id, name: engagementTypes.name }).from(engagementTypes).orderBy(engagementTypes.name)
  return rows
}

/** Utenti selezionabili come responsabile progetto (sezione CLIENTS_MANAGE) */
export async function getUserOptions(): Promise<UserOption[]> {
  const session = await auth()
  requireSection(session, 'CLIENTS_MANAGE')
  const rows = await db
    .selectDistinct({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(users)
    .innerJoin(roles,           eq(roles.id,              users.roleId))
    .innerJoin(roleProfiles,    eq(roleProfiles.roleId,   roles.id))
    .innerJoin(profileSections, and(
      eq(profileSections.profileId,   roleProfiles.profileId),
      eq(profileSections.sectionCode, 'CLIENTS_MANAGE'),
    ))
    .where(eq(users.active, true))
    .orderBy(users.lastName, users.firstName)
  return rows.map((u) => ({ id: u.id, fullName: `${u.lastName} ${u.firstName}`, email: u.email }))
}

/** Utenti assegnabili a una commessa (sezione TIMESHEET abilitata nel ruolo) */
export async function getTimesheetUserOptions(): Promise<UserOption[]> {
  const session = await auth()
  requireSection(session, 'CLIENTS_MANAGE')
  const rows = await db
    .selectDistinct({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(users)
    .innerJoin(roles,           eq(roles.id,              users.roleId))
    .innerJoin(roleProfiles,    eq(roleProfiles.roleId,   roles.id))
    .innerJoin(profileSections, and(
      eq(profileSections.profileId,   roleProfiles.profileId),
      eq(profileSections.sectionCode, 'TIMESHEET'),
    ))
    .where(eq(users.active, true))
    .orderBy(users.lastName, users.firstName)
  return rows.map((u) => ({ id: u.id, fullName: `${u.lastName} ${u.firstName}`, email: u.email }))
}

// ─── Prossimo codice disponibile ─────────────────────────────────────────────

export async function getNextClientCode(): Promise<string> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')
  const rows = await db.select({ code: clients.code }).from(clients)
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.code ?? '0', 10) || 0), 0)
  return String(max + 1).padStart(4, '0')
}

export async function getNextProjectCode(clientId: string): Promise<string> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')
  const rows = await db.select({ code: projects.code }).from(projects).where(eq(projects.clientId, clientId))
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.code ?? '0', 10) || 0), 0)
  return String(max + 1).padStart(4, '0')
}

export async function getNextEngagementCode(projectId: string): Promise<string> {
  const session = await auth()
  requireSection(session, 'CLIENTS_VIEW')
  const rows = await db.select({ code: engagements.code }).from(engagements).where(eq(engagements.projectId, projectId))
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.code ?? '0', 10) || 0), 0)
  return String(max + 1).padStart(4, '0')
}

// ─── Client CRUD ──────────────────────────────────────────────────────────────

const ClientSchema = z.object({
  name: z.string().min(2, 'Il nome è obbligatorio (min 2 caratteri).').max(100),
})

export async function createClient(
  data: { name: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'CLIENTS_MANAGE')

    const parsed = ClientSchema.safeParse(data)
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message }

    const allClientCodes = await db.select({ code: clients.code }).from(clients)
    const clientMaxNum = allClientCodes.reduce((m, r) => Math.max(m, parseInt(r.code ?? '0', 10) || 0), 0)
    const code = String(clientMaxNum + 1).padStart(4, '0')

    const [row] = await db
      .insert(clients)
      .values({ name: parsed.data.name.trim(), code, active: true })
      .returning({ id: clients.id })

    revalidatePath('/clients')
    return { ok: true, id: row.id }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('createClient error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function updateClient(
  id: string,
  data: { name?: string; active?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'CLIENTS_MANAGE')

    if (data.name !== undefined) {
      const parsed = ClientSchema.safeParse({ name: data.name })
      if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message }
    }

    await db
      .update(clients)
      .set({ ...(data.name && { name: data.name.trim() }), ...(data.active !== undefined && { active: data.active }) })
      .where(eq(clients.id, id))

    revalidatePath('/clients')
    revalidatePath(`/clients/${id}`)
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    return { ok: false, error: 'Errore del server.' }
  }
}

// ─── Project CRUD ─────────────────────────────────────────────────────────────

const ProjectSchema = z.object({
  name:              z.string().min(2, 'Il nome è obbligatorio (min 2 caratteri).').max(100),
  responsibleUserId: z.string().uuid().nullable().optional(),
})

export async function createProject(
  clientId: string,
  data: { name: string; responsibleUserId?: string | null },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'CLIENTS_MANAGE')

    const parsed = ProjectSchema.safeParse(data)
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message }

    // Verify client exists
    const clientRow = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1)
    if (!clientRow.length) return { ok: false, error: 'Cliente non trovato.' }

    // Codice univoco dentro lo stesso cliente
    const allProjectCodes = await db.select({ code: projects.code }).from(projects).where(eq(projects.clientId, clientId))
    const projectMaxNum = allProjectCodes.reduce((m, r) => Math.max(m, parseInt(r.code ?? '0', 10) || 0), 0)
    const code = String(projectMaxNum + 1).padStart(4, '0')

    const [row] = await db
      .insert(projects)
      .values({
        name:              parsed.data.name.trim(),
        code,
        clientId,
        responsibleUserId: parsed.data.responsibleUserId ?? session.user.id,
        active:            true,
      })
      .returning({ id: projects.id })

    revalidatePath(`/clients/${clientId}`)
    return { ok: true, id: row.id }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('createProject error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function updateProject(
  id: string,
  data: { name?: string; active?: boolean; responsibleUserId?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'CLIENTS_MANAGE')

    // Ownership check: only responsible or CLIENTS_MANAGE can edit
    const projectRow = await db
      .select({ clientId: projects.clientId, responsibleUserId: projects.responsibleUserId })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1)

    if (!projectRow.length) return { ok: false, error: 'Progetto non trovato.' }

    const { clientId, responsibleUserId } = projectRow[0]
    const userId = session.user.id
    const isResponsible = responsibleUserId === userId

    // Any CLIENTS_MANAGE user can edit (responsibleUserId is just informational for engagement mgmt)
    await db
      .update(projects)
      .set({
        ...(data.name && { name: data.name.trim() }),
        ...(data.active !== undefined && { active: data.active }),
        ...(data.responsibleUserId !== undefined && { responsibleUserId: data.responsibleUserId ?? undefined }),
      })
      .where(eq(projects.id, id))

    revalidatePath(`/clients/${clientId}`)
    revalidatePath(`/clients/${clientId}/projects/${id}`)
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    return { ok: false, error: 'Errore del server.' }
  }
}

// ─── Engagement CRUD ──────────────────────────────────────────────────────────

const EngagementSchema = z.object({
  name:             z.string().min(2, 'Il nome è obbligatorio.').max(100),
  engagementTypeId: z.string().uuid('Tipologia obbligatoria.'),
  totalHours:       z.number().int().positive().optional(),
})

async function checkEngagementOwnership(projectId: string, userId: string): Promise<{ clientId: string } | { error: string }> {
  const projectRow = await db
    .select({ clientId: projects.clientId, responsibleUserId: projects.responsibleUserId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!projectRow.length) return { error: 'Progetto non trovato.' }

  // Solo il responsabile del progetto può creare/modificare commesse
  if (projectRow[0].responsibleUserId !== userId) {
    return { error: 'Solo il responsabile del progetto può gestire le commesse.' }
  }

  return { clientId: projectRow[0].clientId }
}

export async function createEngagement(
  projectId: string,
  data: { name: string; engagementTypeId: string; totalHours?: number },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'CLIENTS_MANAGE')
    const userId = session.user.id

    const parsed = EngagementSchema.safeParse(data)
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message }

    const ownerCheck = await checkEngagementOwnership(projectId, userId)
    if ('error' in ownerCheck) return { ok: false, error: ownerCheck.error }

    // Codice univoco dentro lo stesso progetto
    const allEngCodes = await db.select({ code: engagements.code }).from(engagements).where(eq(engagements.projectId, projectId))
    const engMaxNum = allEngCodes.reduce((m, r) => Math.max(m, parseInt(r.code ?? '0', 10) || 0), 0)
    const code = String(engMaxNum + 1).padStart(4, '0')

    const [row] = await db
      .insert(engagements)
      .values({
        name:             parsed.data.name.trim(),
        code,
        projectId,
        engagementTypeId: parsed.data.engagementTypeId,
        totalHours:       parsed.data.totalHours ?? 999999,
        active:           true,
      })
      .returning({ id: engagements.id })

    revalidatePath(`/clients/${ownerCheck.clientId}/projects/${projectId}`)
    return { ok: true, id: row.id }
  } catch (err: any) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    if (err.code === '23505') return { ok: false, error: 'Codice commessa già in uso.' }
    console.error('createEngagement error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function updateEngagement(
  id: string,
  data: { name?: string; active?: boolean; totalHours?: number },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'CLIENTS_MANAGE')
    const userId = session.user.id

    const engRow = await db
      .select({ projectId: engagements.projectId })
      .from(engagements)
      .where(eq(engagements.id, id))
      .limit(1)

    if (!engRow.length) return { ok: false, error: 'Commessa non trovata.' }

    const ownerCheck = await checkEngagementOwnership(engRow[0].projectId, userId)
    if ('error' in ownerCheck) return { ok: false, error: ownerCheck.error }

    await db
      .update(engagements)
      .set({
        ...(data.name && { name: data.name.trim() }),
        ...(data.active !== undefined && { active: data.active }),
        ...(data.totalHours !== undefined && { totalHours: data.totalHours }),
      })
      .where(eq(engagements.id, id))

    revalidatePath(`/clients/${ownerCheck.clientId}/projects/${engRow[0].projectId}`)
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    return { ok: false, error: 'Errore del server.' }
  }
}

// ─── Assegnazione utenti alla commessa ────────────────────────────────────────

export async function assignUserToEngagement(
  engagementId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'CLIENTS_MANAGE')
    const requesterId = session.user.id

    const engRow = await db
      .select({ projectId: engagements.projectId })
      .from(engagements)
      .where(eq(engagements.id, engagementId))
      .limit(1)

    if (!engRow.length) return { ok: false, error: 'Commessa non trovata.' }

    const ownerCheck = await checkEngagementOwnership(engRow[0].projectId, requesterId)
    if ('error' in ownerCheck) return { ok: false, error: ownerCheck.error }

    await db
      .insert(engagementUsers)
      .values({ engagementId, userId })
      .onConflictDoNothing()

    revalidatePath(`/clients/${ownerCheck.clientId}/projects/${engRow[0].projectId}`)
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function removeUserFromEngagement(
  engagementId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'CLIENTS_MANAGE')
    const requesterId = session.user.id

    const engRow = await db
      .select({ projectId: engagements.projectId })
      .from(engagements)
      .where(eq(engagements.id, engagementId))
      .limit(1)

    if (!engRow.length) return { ok: false, error: 'Commessa non trovata.' }

    const ownerCheck = await checkEngagementOwnership(engRow[0].projectId, requesterId)
    if ('error' in ownerCheck) return { ok: false, error: ownerCheck.error }

    await db
      .delete(engagementUsers)
      .where(and(eq(engagementUsers.engagementId, engagementId), eq(engagementUsers.userId, userId)))

    revalidatePath(`/clients/${ownerCheck.clientId}/projects/${engRow[0].projectId}`)
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    return { ok: false, error: 'Errore del server.' }
  }
}
