'use server'

import { and, eq, asc, isNull } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  purchaseOrders, purchaseOrderLines, purchaseOrderLineStatuses,
  clients, users, engagements, engagementTypes, engagementStatuses, projects,
} from '@/db/schema'
import { requireSection, hasSection } from '@/lib/permissions/auth-helpers'
import { getInvoicedByOdaLine, invoicingFieldsFor, type OdaLineInvoicingFields } from '@/lib/oda-invoicing'

// Campi fatturazione (invoicedAmount, residualAmount, invoiceDocs, invoiceCurrencies):
// null/vuoti se la riga non ha posizione o l'utente non ha INVOICES_VIEW — vedi src/lib/oda-invoicing.ts
export type OdaPerCommessaRow = OdaLineInvoicingFields & {
  // Commessa
  engagementId:       string
  clientId:           string
  clientCode:         string
  clientName:         string
  projectId:          string
  projectCode:        string
  projectName:        string
  engagementCode:     string
  engagementName:     string
  engagementTypeName: string
  conclusa:           boolean
  statusCode:         string | null
  statusDescription:  string | null
  // Posizione OdA (se presente)
  poId:               string | null
  poCode:             string | null
  poNumber:           string | null
  poDate:             string | null
  responsibleName:    string | null
  poTotalAmount:      string | null
  lineId:             string | null
  lineCode:           string | null
  externalReference:  string | null
  description:        string | null
  amount:             string | null
  lineStatusCode:     string | null   // stato posizione OdA (≠ stato commessa)
  lineStatusDesc:     string | null
}

export type FilterOption = { id: string; label: string }

/**
 * Filtro Cod. OdA:
 *   - undefined / null / ''  → tutte
 *   - 'none'                 → solo commesse senza posizioni OdA
 *   - altro                  → codice OdA specifico (es. '000005')
 *
 * Responsabili (filtri distinti):
 *   - odaResponsibleId     → responsabile OdA: esclude le commesse senza OdA
 *   - projectResponsibleId → responsabile progetto: mantiene anche le commesse senza OdA
 */
export async function getOdaPerCommessaReport(filters: {
  clientId?:             string | null
  projectId?:            string | null
  statusId?:             string | null
  odaFilter?:            string | null
  odaResponsibleId?:     string | null
  projectResponsibleId?: string | null
}): Promise<OdaPerCommessaRow[]> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')

  const conditions: any[] = [eq(engagementTypes.noOda, false)]
  if (filters.clientId)             conditions.push(eq(projects.clientId, filters.clientId))
  if (filters.projectId)            conditions.push(eq(engagements.projectId, filters.projectId))
  if (filters.statusId)             conditions.push(eq(engagements.statusId, filters.statusId))
  if (filters.odaResponsibleId)     conditions.push(eq(purchaseOrders.responsibleUserId, filters.odaResponsibleId))
  if (filters.projectResponsibleId) conditions.push(eq(projects.responsibleUserId, filters.projectResponsibleId))
  if (filters.odaFilter === 'none')                  conditions.push(isNull(purchaseOrderLines.id))
  else if (filters.odaFilter && filters.odaFilter)   conditions.push(eq(purchaseOrders.code, filters.odaFilter))
  const where = conditions.length === 1 ? conditions[0] : and(...conditions)

  // I dati di fatturazione sono protetti da INVOICES_VIEW: senza permesso non vengono letti
  const invoicingByLine = hasSection(session, 'INVOICES_VIEW') ? await getInvoicedByOdaLine() : null

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
      statusCode:         engagementStatuses.code,
      statusDescription:  engagementStatuses.description,
      lineId:             purchaseOrderLines.id,
      lineCode:           purchaseOrderLines.code,
      externalReference:  purchaseOrderLines.externalReference,
      description:        purchaseOrderLines.description,
      amount:             purchaseOrderLines.amount,
      lineStatusCode:     purchaseOrderLineStatuses.code,
      lineStatusDesc:     purchaseOrderLineStatuses.description,
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
    .leftJoin (engagementStatuses, eq(engagementStatuses.id, engagements.statusId))
    .leftJoin (purchaseOrderLines, eq(purchaseOrderLines.engagementId, engagements.id))
    .leftJoin (purchaseOrderLineStatuses, eq(purchaseOrderLineStatuses.id, purchaseOrderLines.statusId))
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
    statusCode:         r.statusCode,
    statusDescription:  r.statusDescription,
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
    lineStatusCode:     r.lineStatusCode,
    lineStatusDesc:     r.lineStatusDesc,
    ...invoicingFieldsFor(r.lineId, r.amount, invoicingByLine),
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

export async function getCommessaFilterStatuses(): Promise<FilterOption[]> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')
  const rows = await db
    .select({ id: engagementStatuses.id, code: engagementStatuses.code, description: engagementStatuses.description })
    .from(engagementStatuses)
    .where(eq(engagementStatuses.active, true))
    .orderBy(asc(engagementStatuses.code))
  return rows.map((r) => ({ id: r.id, label: `${r.code} — ${r.description}` }))
}

/**
 * Responsabili progetto con almeno una commessa non «NO OdA».
 * Gated su PURCHASE_ORDERS_VIEW (getProjectManagers di ore-commessa richiede CLIENTS_VIEW).
 */
export async function getCommessaFilterProjectResponsibles(): Promise<FilterOption[]> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')
  const rows = await db
    .selectDistinct({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(projects)
    .innerJoin(users,           eq(users.id, projects.responsibleUserId))
    .innerJoin(engagements,     eq(engagements.projectId, projects.id))
    .innerJoin(engagementTypes, eq(engagementTypes.id, engagements.engagementTypeId))
    .where(eq(engagementTypes.noOda, false))
    .orderBy(asc(users.lastName), asc(users.firstName))
  return rows.map((u) => ({ id: u.id, label: `${u.lastName} ${u.firstName}` }))
}

/** Codici OdA esistenti (per popolare il filtro "Cod. OdA") */
export async function getCommessaFilterOdaCodes(): Promise<{ code: string; number: string }[]> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')
  const rows = await db
    .select({ code: purchaseOrders.code, number: purchaseOrders.number })
    .from(purchaseOrders)
    .orderBy(asc(purchaseOrders.code))
  return rows
}
