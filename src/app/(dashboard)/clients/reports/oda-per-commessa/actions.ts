'use server'

import { and, eq, asc } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  purchaseOrders, purchaseOrderLines,
  clients, users, engagements, engagementTypes, projects,
} from '@/db/schema'
import { requireSection } from '@/lib/permissions/auth-helpers'

export type OdaPerCommessaRow = {
  // Commessa
  engagementId:      string
  clientId:          string
  clientCode:        string
  clientName:        string
  projectId:         string
  projectCode:       string
  projectName:       string
  engagementCode:    string
  engagementName:    string
  engagementTypeName: string
  conclusa:          boolean
  // Posizione OdA (se presente)
  poId:              string | null
  poCode:            string | null
  poNumber:          string | null
  poDate:            string | null
  responsibleName:   string | null
  poTotalAmount:     string | null
  lineId:            string | null
  lineCode:          string | null
  externalReference: string | null
  description:       string | null
  amount:            string | null
}

export type FilterOption = { id: string; label: string }

export async function getOdaPerCommessaReport(filters: {
  clientId?:  string | null
  projectId?: string | null
}): Promise<OdaPerCommessaRow[]> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')

  const conditions: any[] = [eq(engagementTypes.noOda, false)]
  if (filters.clientId)  conditions.push(eq(projects.clientId, filters.clientId))
  if (filters.projectId) conditions.push(eq(engagements.projectId, filters.projectId))
  const where = conditions.length === 1 ? conditions[0] : and(...conditions)

  // LEFT JOIN posizioni OdA → commesse senza OdA appaiono comunque
  const rows = await db
    .select({
      engagementId:       engagements.id,
      clientId:           clients.id,
      clientCode:         clients.code,
      clientName:         clients.name,
      projectId:          projects.id,
      projectCode:        projects.code,
      projectName:        projects.name,
      engagementCode:     engagements.code,
      engagementName:     engagements.name,
      engagementTypeName: engagementTypes.name,
      conclusa:           engagements.conclusa,
      lineId:             purchaseOrderLines.id,
      lineCode:           purchaseOrderLines.code,
      externalReference:  purchaseOrderLines.externalReference,
      description:        purchaseOrderLines.description,
      amount:             purchaseOrderLines.amount,
      poId:               purchaseOrders.id,
      poCode:             purchaseOrders.code,
      poNumber:           purchaseOrders.number,
      poDate:             purchaseOrders.date,
      poTotalAmount:      purchaseOrders.totalAmount,
      respFirst:          users.firstName,
      respLast:           users.lastName,
    })
    .from(engagements)
    .innerJoin(engagementTypes, eq(engagementTypes.id, engagements.engagementTypeId))
    .innerJoin(projects,        eq(projects.id, engagements.projectId))
    .innerJoin(clients,         eq(clients.id, projects.clientId))
    .leftJoin (purchaseOrderLines, eq(purchaseOrderLines.engagementId, engagements.id))
    .leftJoin (purchaseOrders,     eq(purchaseOrders.id, purchaseOrderLines.purchaseOrderId))
    .leftJoin (users,              eq(users.id, purchaseOrders.responsibleUserId))
    .where(where)
    .orderBy(asc(clients.name), asc(projects.code), asc(engagements.code), asc(purchaseOrders.code), asc(purchaseOrderLines.code))

  return rows.map((r) => ({
    engagementId:       r.engagementId,
    clientId:           r.clientId,
    clientCode:         r.clientCode,
    clientName:         r.clientName,
    projectId:          r.projectId,
    projectCode:        r.projectCode,
    projectName:        r.projectName,
    engagementCode:     r.engagementCode,
    engagementName:     r.engagementName,
    engagementTypeName: r.engagementTypeName,
    conclusa:           r.conclusa,
    poId:               r.poId,
    poCode:             r.poCode,
    poNumber:           r.poNumber,
    poDate:             r.poDate,
    responsibleName:    r.respLast ? `${r.respLast} ${r.respFirst}` : null,
    poTotalAmount:      r.poTotalAmount,
    lineId:             r.lineId,
    lineCode:           r.lineCode,
    externalReference:  r.externalReference,
    description:        r.description,
    amount:             r.amount,
  }))
}

// ─── Filtri ──────────────────────────────────────────────────────────────────

export async function getCommessaFilterClients(): Promise<FilterOption[]> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')
  // Tutti i clienti che hanno almeno una commessa con tipologia non NO OdA
  const rows = await db
    .selectDistinct({ id: clients.id, name: clients.name, code: clients.code })
    .from(clients)
    .innerJoin(projects,        eq(projects.clientId, clients.id))
    .innerJoin(engagements,     eq(engagements.projectId, projects.id))
    .innerJoin(engagementTypes, eq(engagementTypes.id, engagements.engagementTypeId))
    .where(eq(engagementTypes.noOda, false))
    .orderBy(asc(clients.name))
  return rows.map((c) => ({ id: c.id, label: `${c.name} (${c.code})` }))
}

export async function getCommessaFilterProjects(clientId: string | null): Promise<FilterOption[]> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')
  const conds: any[] = [eq(engagementTypes.noOda, false)]
  if (clientId) conds.push(eq(projects.clientId, clientId))
  const rows = await db
    .selectDistinct({ id: projects.id, name: projects.name, code: projects.code })
    .from(projects)
    .innerJoin(engagements,     eq(engagements.projectId, projects.id))
    .innerJoin(engagementTypes, eq(engagementTypes.id, engagements.engagementTypeId))
    .where(conds.length === 1 ? conds[0] : and(...conds))
    .orderBy(asc(projects.name))
  return rows.map((p) => ({ id: p.id, label: `${p.name} (${p.code})` }))
}
