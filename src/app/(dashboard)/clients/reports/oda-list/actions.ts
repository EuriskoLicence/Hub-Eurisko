'use server'

import { and, eq, asc, isNotNull, sql } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  purchaseOrders, purchaseOrderLines, purchaseOrderLineStatuses,
  clients, users, engagements, projects,
  invoices, invoiceLines,
} from '@/db/schema'
import { requireSection, hasSection } from '@/lib/permissions/auth-helpers'

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
  // Fatturazione: null se la riga non ha posizione o l'utente non ha INVOICES_VIEW
  invoicedAmount:    number | null   // Σ posizioni fattura abbinate (fatture +, note credito −), IVA esclusa
  residualAmount:    number | null   // importo posizione − fatturato
  invoiceDocs:       number          // n. documenti (fatture + note credito) abbinati
  invoiceCurrencies: string[]        // divise dei documenti abbinati
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

  // I dati di fatturazione sono protetti da INVOICES_VIEW: senza permesso non vengono letti
  const canSeeInvoicing = hasSection(session, 'INVOICES_VIEW')

  // Fatturato per posizione OdA: fatture in positivo, note credito in negativo
  const invoicingByLine = new Map<string, { invoiced: number; docs: number; currencies: string[] }>()
  if (canSeeInvoicing) {
    const invRows = await db
      .select({
        polId:      invoiceLines.purchaseOrderLineId,
        invoiced:   sql<string>`coalesce(sum(case when ${invoices.type} = 'credit_note' then -${invoiceLines.amount} else ${invoiceLines.amount} end), 0)`,
        docs:       sql<number>`cast(count(distinct ${invoices.id}) as int)`,
        currencies: sql<string>`string_agg(distinct ${invoices.currency}, ',')`,
      })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
      .where(and(
        eq(invoiceLines.isOdaRelated, true),
        isNotNull(invoiceLines.purchaseOrderLineId),
      ))
      .groupBy(invoiceLines.purchaseOrderLineId)

    for (const r of invRows) {
      if (!r.polId) continue
      invoicingByLine.set(r.polId, {
        invoiced:   Number(r.invoiced),
        docs:       Number(r.docs),
        currencies: r.currencies ? r.currencies.split(',') : [],
      })
    }
  }

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

  const round2 = (n: number) => Math.round(n * 100) / 100

  return rows.map((r) => {
    const inv            = r.lineId ? invoicingByLine.get(r.lineId) : undefined
    const invoicedAmount = canSeeInvoicing && r.lineId ? round2(inv?.invoiced ?? 0) : null
    const residualAmount = invoicedAmount !== null && r.amount !== null
      ? round2(Number(r.amount) - invoicedAmount)
      : null

    return {
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
      invoicedAmount,
      residualAmount,
      invoiceDocs:       inv?.docs ?? 0,
      invoiceCurrencies: inv?.currencies ?? [],
    }
  })
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
