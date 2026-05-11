'use server'

import { and, eq, asc } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  purchaseOrders, purchaseOrderLines, purchaseOrderLineStatuses,
  clients, users, engagements, projects,
} from '@/db/schema'
import { requireSection } from '@/lib/permissions/auth-helpers'

export type OdaListReportRow = {
  // Testata
  poId:              string
  poCode:            string
  poNumber:          string
  poDate:            string
  clientCode:        string
  clientName:        string
  totalAmount:       string
  responsibleName:   string
  responsibleEmail:  string
  needsReview:       boolean
  // Posizione (può essere null se l'OdA non ha posizioni)
  lineId:            string | null
  lineCode:          string | null
  externalReference: string | null
  description:       string | null
  amount:            string | null
  projectCode:       string | null
  projectName:       string | null
  engagementCode:    string | null
  engagementName:    string | null
  lineStatusCode:    string | null
  lineStatusDesc:    string | null
}

export type FilterOption = { id: string; label: string }

export async function getOdaListReport(filters: {
  clientId?:      string | null
  responsibleId?: string | null
  lineStatusId?:  string | null
}): Promise<OdaListReportRow[]> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')

  const conditions: any[] = []
  if (filters.clientId)      conditions.push(eq(purchaseOrders.clientId,          filters.clientId))
  if (filters.responsibleId) conditions.push(eq(purchaseOrders.responsibleUserId, filters.responsibleId))
  if (filters.lineStatusId)  conditions.push(eq(purchaseOrderLines.statusId,      filters.lineStatusId))
  const where = conditions.length === 0 ? undefined
              : conditions.length === 1 ? conditions[0]
              :                            and(...conditions)

  // LEFT JOIN posizioni → riga vuota di posizione se l'OdA non ne ha
  const rows = await db
    .select({
      poId:              purchaseOrders.id,
      poCode:            purchaseOrders.code,
      poNumber:          purchaseOrders.number,
      poDate:            purchaseOrders.date,
      clientCode:        clients.code,
      clientName:        clients.name,
      totalAmount:       purchaseOrders.totalAmount,
      respFirst:         users.firstName,
      respLast:          users.lastName,
      respEmail:         users.email,
      needsReview:       purchaseOrders.needsReview,
      lineId:            purchaseOrderLines.id,
      lineCode:          purchaseOrderLines.code,
      externalReference: purchaseOrderLines.externalReference,
      description:       purchaseOrderLines.description,
      amount:            purchaseOrderLines.amount,
      engagementId:      purchaseOrderLines.engagementId,
      lineStatusCode:    purchaseOrderLineStatuses.code,
      lineStatusDesc:    purchaseOrderLineStatuses.description,
      engagementCode:    engagements.code,
      engagementName:    engagements.name,
      projectCode:       projects.code,
      projectName:       projects.name,
    })
    .from(purchaseOrders)
    .innerJoin(clients, eq(clients.id, purchaseOrders.clientId))
    .innerJoin(users,   eq(users.id,   purchaseOrders.responsibleUserId))
    .leftJoin (purchaseOrderLines,         eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id))
    .leftJoin (purchaseOrderLineStatuses,  eq(purchaseOrderLineStatuses.id, purchaseOrderLines.statusId))
    .leftJoin (engagements, eq(engagements.id, purchaseOrderLines.engagementId))
    .leftJoin (projects,    eq(projects.id, engagements.projectId))
    .where(where)
    .orderBy(asc(purchaseOrders.code), asc(purchaseOrderLines.code))

  return rows.map((r) => ({
    poId:              r.poId,
    poCode:            r.poCode,
    poNumber:          r.poNumber,
    poDate:            r.poDate,
    clientCode:        r.clientCode,
    clientName:        r.clientName,
    totalAmount:       r.totalAmount,
    responsibleName:   `${r.respLast} ${r.respFirst}`,
    responsibleEmail:  r.respEmail,
    needsReview:       r.needsReview,
    lineId:            r.lineId,
    lineCode:          r.lineCode,
    externalReference: r.externalReference,
    description:       r.description,
    amount:            r.amount,
    projectCode:       r.projectCode,
    projectName:       r.projectName,
    engagementCode:    r.engagementCode,
    engagementName:    r.engagementName,
    lineStatusCode:    r.lineStatusCode,
    lineStatusDesc:    r.lineStatusDesc,
  }))
}

// ─── Filtri ──────────────────────────────────────────────────────────────────

export async function getOdaFilterClients(): Promise<FilterOption[]> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')
  // Solo clienti che hanno almeno un'OdA
  const rows = await db
    .selectDistinct({ id: clients.id, name: clients.name, code: clients.code })
    .from(clients)
    .innerJoin(purchaseOrders, eq(purchaseOrders.clientId, clients.id))
    .orderBy(asc(clients.name))
  return rows.map((c) => ({ id: c.id, label: `${c.name} (${c.code})` }))
}

export async function getOdaFilterResponsibles(): Promise<FilterOption[]> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')
  // Solo responsabili che hanno almeno un'OdA assegnata
  const rows = await db
    .selectDistinct({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .innerJoin(purchaseOrders, eq(purchaseOrders.responsibleUserId, users.id))
    .orderBy(asc(users.lastName), asc(users.firstName))
  return rows.map((u) => ({ id: u.id, label: `${u.lastName} ${u.firstName}` }))
}

export async function getOdaFilterLineStatuses(): Promise<FilterOption[]> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')
  const rows = await db
    .select({ id: purchaseOrderLineStatuses.id, code: purchaseOrderLineStatuses.code, description: purchaseOrderLineStatuses.description })
    .from(purchaseOrderLineStatuses)
    .where(eq(purchaseOrderLineStatuses.active, true))
    .orderBy(asc(purchaseOrderLineStatuses.code))
  return rows.map((r) => ({ id: r.id, label: `${r.code} — ${r.description}` }))
}
