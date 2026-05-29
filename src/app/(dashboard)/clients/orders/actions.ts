'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql, asc, inArray, isNull, count, gt, ne } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  purchaseOrders, purchaseOrderAttachments, purchaseOrderLines, purchaseOrderLineStatuses,
  clients, users, roles, roleProfiles, profileSections,
  engagements, engagementTypes, projects,
} from '@/db/schema'
import { requireSection, hasSection, HttpError } from '@/lib/permissions/auth-helpers'
import { deleteObject } from '@/lib/r2'
import {
  sendPurchaseOrderAssignedEmail,
  sendPurchaseOrderTotalChangedEmail,
  sendPurchaseOrderReminderEmail,
} from '@/lib/email'
import { z } from 'zod'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PurchaseOrderRow = {
  id:                string
  code:              string
  date:              string   // YYYY-MM-DD
  number:            string
  clientId:          string
  clientName:        string
  totalAmount:       string   // string from numeric column
  responsibleUserId: string
  responsibleName:   string
  needsReview:       boolean
  hasPositions:      boolean
  positionsCount:    number
  attachmentsCount:  number
}

export type PurchaseOrderDetail = {
  id:                string
  code:              string
  date:              string
  number:            string
  clientId:          string
  clientName:        string
  totalAmount:       string
  responsibleUserId: string
  responsibleName:   string
  responsibleEmail:  string
  notes:             string | null
  needsReview:       boolean
  attachments: { id: string; key: string; filename: string; uploadedAt: string }[]
  lines: {
    id:                string
    code:              string
    externalReference: string | null
    description:       string
    amount:            string
    engagementId:      string
    engagementLabel:   string
    statusId:          string | null
    statusCode:        string | null
    statusDescription: string | null
  }[]
}

export type ResponsibleOption = { id: string; name: string; email: string }

export type EngagementOption = { id: string; label: string; inactive?: boolean }

export type LineStatusOption = { id: string; code: string; description: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Genera il codice 6 cifre OdA usando la sequenza Postgres */
async function generatePurchaseOrderCode(): Promise<string> {
  const result = await db.execute<{ code: string }>(
    sql`SELECT LPAD(nextval('purchase_orders_code_seq')::text, 6, '0') AS code`,
  )
  // Drizzle può ritornare un array (neon-http) o un oggetto con `.rows` (neon-serverless)
  const rows: Array<{ code: string }> = Array.isArray(result)
    ? (result as any)
    : ((result as any).rows ?? [])
  if (!rows.length || !rows[0].code) throw new Error('Errore generazione codice OdA')
  return rows[0].code
}

/** Calcola il prossimo codice posizione a 3 cifre per un'OdA */
async function nextLineCode(purchaseOrderId: string): Promise<string> {
  const existing = await db
    .select({ code: purchaseOrderLines.code })
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.purchaseOrderId, purchaseOrderId))
  const maxNum = existing.reduce((m, r) => Math.max(m, parseInt(r.code, 10) || 0), 0)
  return String(maxNum + 1).padStart(3, '0')
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getPurchaseOrders(filters?: {
  clientId?:      string
  responsibleId?: string
  onlyOpen?:      boolean   // se true, solo OdA senza posizioni
}): Promise<PurchaseOrderRow[]> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')

  const conditions: any[] = []
  if (filters?.clientId)      conditions.push(eq(purchaseOrders.clientId, filters.clientId))
  if (filters?.responsibleId) conditions.push(eq(purchaseOrders.responsibleUserId, filters.responsibleId))

  const where = conditions.length === 0 ? undefined
              : conditions.length === 1 ? conditions[0]
              :                            and(...conditions)

  const rows = await db
    .select({
      id:                purchaseOrders.id,
      code:              purchaseOrders.code,
      date:              purchaseOrders.date,
      number:            purchaseOrders.number,
      clientId:          purchaseOrders.clientId,
      clientName:        clients.name,
      totalAmount:       purchaseOrders.totalAmount,
      responsibleUserId: purchaseOrders.responsibleUserId,
      respFirst:         users.firstName,
      respLast:          users.lastName,
      needsReview:       purchaseOrders.needsReview,
      positionsCount:    sql<number>`cast((select count(*) from ${purchaseOrderLines} where ${purchaseOrderLines.purchaseOrderId} = ${purchaseOrders.id}) as int)`,
      attachmentsCount:  sql<number>`cast((select count(*) from ${purchaseOrderAttachments} where ${purchaseOrderAttachments.purchaseOrderId} = ${purchaseOrders.id}) as int)`,
    })
    .from(purchaseOrders)
    .innerJoin(clients, eq(clients.id, purchaseOrders.clientId))
    .innerJoin(users,   eq(users.id,   purchaseOrders.responsibleUserId))
    .where(where)
    .orderBy(sql`${purchaseOrders.date} DESC`, sql`${purchaseOrders.code} DESC`)

  let mapped: PurchaseOrderRow[] = rows.map((r) => ({
    id:                r.id,
    code:              r.code,
    date:              r.date,
    number:            r.number,
    clientId:          r.clientId,
    clientName:        r.clientName,
    totalAmount:       r.totalAmount,
    responsibleUserId: r.responsibleUserId,
    responsibleName:   `${r.respLast} ${r.respFirst}`,
    needsReview:       r.needsReview,
    hasPositions:      Number(r.positionsCount) > 0,
    positionsCount:    Number(r.positionsCount),
    attachmentsCount:  Number(r.attachmentsCount),
  }))

  if (filters?.onlyOpen) mapped = mapped.filter((r) => !r.hasPositions)
  return mapped
}

export async function getPurchaseOrderDetail(id: string): Promise<PurchaseOrderDetail | null> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')

  const headRows = await db
    .select({
      id:                purchaseOrders.id,
      code:              purchaseOrders.code,
      date:              purchaseOrders.date,
      number:            purchaseOrders.number,
      clientId:          purchaseOrders.clientId,
      clientName:        clients.name,
      totalAmount:       purchaseOrders.totalAmount,
      responsibleUserId: purchaseOrders.responsibleUserId,
      respFirst:         users.firstName,
      respLast:          users.lastName,
      respEmail:         users.email,
      notes:             purchaseOrders.notes,
      needsReview:       purchaseOrders.needsReview,
    })
    .from(purchaseOrders)
    .innerJoin(clients, eq(clients.id, purchaseOrders.clientId))
    .innerJoin(users,   eq(users.id,   purchaseOrders.responsibleUserId))
    .where(eq(purchaseOrders.id, id))
    .limit(1)

  if (!headRows.length) return null
  const h = headRows[0]

  const attRows = await db
    .select()
    .from(purchaseOrderAttachments)
    .where(eq(purchaseOrderAttachments.purchaseOrderId, id))
    .orderBy(asc(purchaseOrderAttachments.uploadedAt))

  const lineRows = await db
    .select({
      id:                purchaseOrderLines.id,
      code:              purchaseOrderLines.code,
      externalReference: purchaseOrderLines.externalReference,
      description:       purchaseOrderLines.description,
      amount:            purchaseOrderLines.amount,
      engagementId:      purchaseOrderLines.engagementId,
      engCode:           engagements.code,
      engName:           engagements.name,
      projectName:       projects.name,
      statusId:          purchaseOrderLines.statusId,
      statusCode:        purchaseOrderLineStatuses.code,
      statusDescription: purchaseOrderLineStatuses.description,
    })
    .from(purchaseOrderLines)
    .innerJoin(engagements, eq(engagements.id, purchaseOrderLines.engagementId))
    .innerJoin(projects,    eq(projects.id, engagements.projectId))
    .leftJoin (purchaseOrderLineStatuses, eq(purchaseOrderLineStatuses.id, purchaseOrderLines.statusId))
    .where(eq(purchaseOrderLines.purchaseOrderId, id))
    .orderBy(asc(purchaseOrderLines.code))

  return {
    id:                h.id,
    code:              h.code,
    date:              h.date,
    number:            h.number,
    clientId:          h.clientId,
    clientName:        h.clientName,
    totalAmount:       h.totalAmount,
    responsibleUserId: h.responsibleUserId,
    responsibleName:   `${h.respLast} ${h.respFirst}`,
    responsibleEmail:  h.respEmail,
    notes:             h.notes,
    needsReview:       h.needsReview,
    attachments: attRows.map((a) => ({
      id:         a.id,
      key:        a.attachmentKey,
      filename:   a.attachmentFilename,
      uploadedAt: a.uploadedAt.toISOString(),
    })),
    lines: lineRows.map((l) => ({
      id:                l.id,
      code:              l.code,
      externalReference: l.externalReference,
      description:       l.description,
      amount:            l.amount,
      engagementId:      l.engagementId,
      engagementLabel:   `${l.projectName} · ${l.engCode} ${l.engName}`,
      statusId:          l.statusId,
      statusCode:        l.statusCode,
      statusDescription: l.statusDescription,
    })),
  }
}

/** Utenti candidati a essere "responsabile OdA": hanno almeno un ruolo che include un profilo con PURCHASE_ORDERS_MANAGE. */
export async function getResponsibleCandidates(): Promise<ResponsibleOption[]> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')

  const rows = await db
    .selectDistinct({
      id:        users.id,
      firstName: users.firstName,
      lastName:  users.lastName,
      email:     users.email,
    })
    .from(users)
    .innerJoin(roles,           eq(roles.id, users.roleId))
    .innerJoin(roleProfiles,    eq(roleProfiles.roleId, roles.id))
    .innerJoin(profileSections, eq(profileSections.profileId, roleProfiles.profileId))
    .where(and(
      eq(users.active, true),
      eq(profileSections.sectionCode, 'PURCHASE_ORDERS_MANAGE'),
    ))
    .orderBy(asc(users.lastName), asc(users.firstName))

  return rows.map((r) => ({ id: r.id, name: `${r.lastName} ${r.firstName}`, email: r.email }))
}

/** Commesse selezionabili per le posizioni di un'OdA: del cliente di testata, attive (validUntil >= oggi), non concluse, tipologia non NO OdA. */
export async function getOpenEngagementsForClient(clientId: string): Promise<EngagementOption[]> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')

  const today = new Date().toISOString().split('T')[0]

  const rows = await db
    .select({
      id:          engagements.id,
      engCode:     engagements.code,
      engName:     engagements.name,
      projectName: projects.name,
      projectCode: projects.code,
    })
    .from(engagements)
    .innerJoin(projects,        eq(projects.id, engagements.projectId))
    .innerJoin(engagementTypes, eq(engagementTypes.id, engagements.engagementTypeId))
    .where(and(
      eq(projects.clientId, clientId),
      eq(projects.active, true),
      eq(engagementTypes.noOda, false),
      eq(engagements.conclusa, false),
      sql`${engagements.validUntil} >= ${today}`,
    ))
    .orderBy(asc(projects.name), asc(engagements.code))

  return rows.map((r) => ({
    id:    r.id,
    label: `${r.projectName} (${r.projectCode}) · ${r.engCode} ${r.engName}`,
  }))
}

/**
 * Commesse già referenziate dalle posizioni di un'OdA che NON sarebbero più
 * selezionabili oggi (progetto inattivo, conclusa, validUntil scaduto, oppure
 * tipologia ora flaggata NO OdA). Servono per mostrare correttamente la commessa
 * nelle posizioni storiche del grid (marcate come inactive=true).
 */
export async function getReferencedInactiveEngagementsForOrder(
  purchaseOrderId: string,
): Promise<EngagementOption[]> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')

  const today = new Date().toISOString().split('T')[0]

  // Recupera la testata per ottenere il clientId
  const headRows = await db
    .select({ clientId: purchaseOrders.clientId })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, purchaseOrderId))
    .limit(1)
  if (!headRows.length) return []
  const clientId = headRows[0].clientId

  // Tutte le commesse referenziate dalle posizioni di quest'OdA
  const referenced = await db
    .selectDistinct({
      id:                engagements.id,
      engCode:           engagements.code,
      engName:           engagements.name,
      projectName:       projects.name,
      projectCode:       projects.code,
      projectActive:     projects.active,
      projectClientId:   projects.clientId,
      conclusa:          engagements.conclusa,
      validUntil:        engagements.validUntil,
      typeNoOda:         engagementTypes.noOda,
    })
    .from(purchaseOrderLines)
    .innerJoin(engagements,     eq(engagements.id, purchaseOrderLines.engagementId))
    .innerJoin(projects,        eq(projects.id,    engagements.projectId))
    .innerJoin(engagementTypes, eq(engagementTypes.id, engagements.engagementTypeId))
    .where(eq(purchaseOrderLines.purchaseOrderId, purchaseOrderId))

  // Filtra solo quelle che NON soddisfano i criteri di getOpenEngagementsForClient
  const inactive = referenced.filter((r) => {
    return r.projectClientId !== clientId
        || r.projectActive === false
        || r.typeNoOda === true
        || r.conclusa === true
        || r.validUntil < today
  })

  return inactive.map((r) => ({
    id:       r.id,
    label:    `${r.projectName} (${r.projectCode}) · ${r.engCode} ${r.engName} [Inattiva]`,
    inactive: true,
  }))
}

/** Stati posizione OdA attivi (per le select nel grid posizioni). */
export async function getPurchaseOrderLineStatusOptions(): Promise<LineStatusOption[]> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')

  const rows = await db
    .select({ id: purchaseOrderLineStatuses.id, code: purchaseOrderLineStatuses.code, description: purchaseOrderLineStatuses.description })
    .from(purchaseOrderLineStatuses)
    .where(eq(purchaseOrderLineStatuses.active, true))
    .orderBy(asc(purchaseOrderLineStatuses.code))

  return rows
}

// ─── WRITE ────────────────────────────────────────────────────────────────────

const CreateOdaSchema = z.object({
  id:                z.string().uuid().optional(), // pre-generato client-side per allineare path R2 degli allegati
  date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida.'),
  number:            z.string().min(1, 'Numero OdA obbligatorio.').max(80),
  clientId:          z.string().uuid('Cliente obbligatorio.'),
  totalAmount:       z.number().nonnegative('Importo non valido.'),
  responsibleUserId: z.string().uuid('Responsabile obbligatorio.'),
  notes:             z.string().max(2000).optional().nullable(),
  attachments:       z.array(z.object({
                       key:      z.string().min(1),
                       filename: z.string().min(1).max(255),
                     })).min(1, 'Allegare almeno un documento.'),
})

export async function createPurchaseOrder(
  data: {
    id?: string;
    date: string; number: string; clientId: string; totalAmount: number;
    responsibleUserId: string; notes?: string | null;
    attachments: { key: string; filename: string }[];
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PURCHASE_ORDERS_MANAGE')

    const parsed = CreateOdaSchema.safeParse(data)
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message }

    // Validazione: tutte le key degli allegati devono iniziare con purchase-orders/{id}/
    if (parsed.data.id) {
      const prefix = `purchase-orders/${parsed.data.id}/`
      for (const a of parsed.data.attachments) {
        if (!a.key.startsWith(prefix)) {
          return { ok: false, error: 'Allegato con percorso non valido.' }
        }
      }
    }

    const code = await generatePurchaseOrderCode()

    const insertValues: any = {
      code,
      date:              parsed.data.date,
      number:            parsed.data.number.trim(),
      clientId:          parsed.data.clientId,
      totalAmount:       parsed.data.totalAmount.toFixed(2),
      responsibleUserId: parsed.data.responsibleUserId,
      notes:             parsed.data.notes?.trim() || null,
      needsReview:       false,
    }
    if (parsed.data.id) insertValues.id = parsed.data.id

    const [row] = await db
      .insert(purchaseOrders)
      .values(insertValues)
      .returning({ id: purchaseOrders.id })

    if (parsed.data.attachments.length > 0) {
      await db.insert(purchaseOrderAttachments).values(
        parsed.data.attachments.map((a) => ({
          purchaseOrderId:    row.id,
          attachmentKey:      a.key,
          attachmentFilename: a.filename,
        })),
      )
    }

    // Invio email al responsabile (fire-and-forget)
    const respRows = await db
      .select({
        firstName: users.firstName,
        lastName:  users.lastName,
        email:     users.email,
      })
      .from(users)
      .innerJoin(clients, eq(clients.id, parsed.data.clientId))
      .where(eq(users.id, parsed.data.responsibleUserId))
      .limit(1)
    const clientRows = await db
      .select({ name: clients.name })
      .from(clients)
      .where(eq(clients.id, parsed.data.clientId))
      .limit(1)

    if (respRows.length && clientRows.length) {
      const r = respRows[0]
      sendPurchaseOrderAssignedEmail({
        poId:        row.id,
        userEmail:   r.email,
        userName:    `${r.firstName} ${r.lastName}`,
        poCode:      code,
        poNumber:    parsed.data.number.trim(),
        clientName:  clientRows[0].name,
        totalAmount: parsed.data.totalAmount,
        date:        parsed.data.date,
      }).catch((e) => console.error('mail PO assigned error:', e))
    }

    revalidatePath('/clients/orders')
    revalidatePath(`/clients/orders/${row.id}`)
    return { ok: true, id: row.id }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('createPurchaseOrder error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}

const UpdateOdaSchema = z.object({
  date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  number:            z.string().min(1).max(80).optional(),
  clientId:          z.string().uuid().optional(),
  totalAmount:       z.number().nonnegative().optional(),
  responsibleUserId: z.string().uuid().optional(),
  notes:             z.string().max(2000).nullable().optional(),
  confirmAmountChange: z.boolean().optional(),
})

export async function updatePurchaseOrder(
  id: string,
  data: {
    date?: string; number?: string; clientId?: string; totalAmount?: number;
    responsibleUserId?: string; notes?: string | null;
    confirmAmountChange?: boolean;
  },
): Promise<{ ok: true; needsReview: boolean } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PURCHASE_ORDERS_MANAGE')

    const parsed = UpdateOdaSchema.safeParse(data)
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message }

    const existingRows = await db
      .select({
        clientId:          purchaseOrders.clientId,
        totalAmount:       purchaseOrders.totalAmount,
        responsibleUserId: purchaseOrders.responsibleUserId,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id))
      .limit(1)
    if (!existingRows.length) return { ok: false, error: 'OdA non trovato.' }
    const existing = existingRows[0]

    // Check posizioni (per cambio importo / cambio cliente)
    const linesAggRows = await db
      .select({ count: count(), sum: sql<string>`coalesce(sum(${purchaseOrderLines.amount}), 0)` })
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.purchaseOrderId, id))
    const positionsCount = Number(linesAggRows[0]?.count ?? 0)
    const positionsSum   = Number(linesAggRows[0]?.sum   ?? 0)

    const newTotalAmount = parsed.data.totalAmount
    const isAmountChanging = newTotalAmount !== undefined && Math.abs(newTotalAmount - Number(existing.totalAmount)) > 0.001

    if (isAmountChanging && positionsCount > 0 && !parsed.data.confirmAmountChange) {
      return { ok: false, error: 'Conferma richiesta: l\'OdA ha posizioni; modificare l\'importo richiede conferma esplicita.' }
    }

    if (parsed.data.clientId && parsed.data.clientId !== existing.clientId && positionsCount > 0) {
      return { ok: false, error: 'Non puoi cambiare cliente: l\'OdA ha già posizioni associate. Eliminale prima di cambiare cliente.' }
    }

    // Calcola nuovo needsReview
    let newNeedsReview: boolean | undefined
    if (isAmountChanging && positionsCount > 0) {
      newNeedsReview = Math.abs(newTotalAmount! - positionsSum) > 0.01
    }

    const set: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.date !== undefined)              set.date = parsed.data.date
    if (parsed.data.number !== undefined)            set.number = parsed.data.number.trim()
    if (parsed.data.clientId !== undefined)          set.clientId = parsed.data.clientId
    if (parsed.data.totalAmount !== undefined)       set.totalAmount = parsed.data.totalAmount.toFixed(2)
    if (parsed.data.responsibleUserId !== undefined) set.responsibleUserId = parsed.data.responsibleUserId
    if (parsed.data.notes !== undefined)             set.notes = parsed.data.notes?.trim() || null
    if (newNeedsReview !== undefined)                set.needsReview = newNeedsReview

    await db.update(purchaseOrders).set(set).where(eq(purchaseOrders.id, id))

    // ── Email: cambio responsabile → notifica al NUOVO ──
    const responsibleChanged = parsed.data.responsibleUserId !== undefined &&
                               parsed.data.responsibleUserId !== existing.responsibleUserId
    if (responsibleChanged) {
      const detailRows = await db
        .select({
          code:        purchaseOrders.code,
          number:      purchaseOrders.number,
          date:        purchaseOrders.date,
          totalAmount: purchaseOrders.totalAmount,
          clientName:  clients.name,
          firstName:   users.firstName,
          lastName:    users.lastName,
          email:       users.email,
        })
        .from(purchaseOrders)
        .innerJoin(clients, eq(clients.id, purchaseOrders.clientId))
        .innerJoin(users,   eq(users.id,   purchaseOrders.responsibleUserId))
        .where(eq(purchaseOrders.id, id))
        .limit(1)
      if (detailRows.length) {
        const d = detailRows[0]
        sendPurchaseOrderAssignedEmail({
          poId:        id,
          userEmail:   d.email,
          userName:    `${d.firstName} ${d.lastName}`,
          poCode:      d.code,
          poNumber:    d.number,
          clientName:  d.clientName,
          totalAmount: d.totalAmount,
          date:        d.date,
        }).catch((e) => console.error('mail PO reassigned error:', e))
      }
    }

    // ── Email: importo modificato con posizioni → notifica al responsabile ──
    if (newNeedsReview === true) {
      const detailRows = await db
        .select({
          code:        purchaseOrders.code,
          number:      purchaseOrders.number,
          totalAmount: purchaseOrders.totalAmount,
          clientName:  clients.name,
          firstName:   users.firstName,
          lastName:    users.lastName,
          email:       users.email,
        })
        .from(purchaseOrders)
        .innerJoin(clients, eq(clients.id, purchaseOrders.clientId))
        .innerJoin(users,   eq(users.id,   purchaseOrders.responsibleUserId))
        .where(eq(purchaseOrders.id, id))
        .limit(1)
      if (detailRows.length) {
        const d = detailRows[0]
        sendPurchaseOrderTotalChangedEmail({
          poId:            id,
          userEmail:       d.email,
          userName:        `${d.firstName} ${d.lastName}`,
          poCode:          d.code,
          poNumber:        d.number,
          clientName:      d.clientName,
          oldAmount:       existing.totalAmount,
          newAmount:       d.totalAmount,
          currentLinesSum: positionsSum,
        }).catch((e) => console.error('mail PO total-changed error:', e))
      }
    }

    revalidatePath('/clients/orders')
    revalidatePath(`/clients/orders/${id}`)
    return { ok: true, needsReview: newNeedsReview ?? false }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('updatePurchaseOrder error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function deletePurchaseOrder(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PURCHASE_ORDERS_MANAGE')

    const linesAgg = await db
      .select({ c: count() })
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.purchaseOrderId, id))
    if (Number(linesAgg[0]?.c ?? 0) > 0) {
      return { ok: false, error: 'Impossibile eliminare: l\'OdA ha posizioni associate. Eliminale prima.' }
    }

    // Recupera allegati per pulizia R2
    const atts = await db
      .select({ key: purchaseOrderAttachments.attachmentKey })
      .from(purchaseOrderAttachments)
      .where(eq(purchaseOrderAttachments.purchaseOrderId, id))

    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id))

    // Cancellazione fire-and-forget dei file su R2
    for (const a of atts) {
      deleteObject(a.key).catch((e) => console.error('R2 delete failed:', a.key, e))
    }

    revalidatePath('/clients/orders')
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('deletePurchaseOrder error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}

// ─── ATTACHMENTS ──────────────────────────────────────────────────────────────

export async function addPurchaseOrderAttachment(
  purchaseOrderId: string,
  data: { key: string; filename: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PURCHASE_ORDERS_MANAGE')

    const exists = await db.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.id, purchaseOrderId)).limit(1)
    if (!exists.length) return { ok: false, error: 'OdA non trovato.' }

    const [row] = await db
      .insert(purchaseOrderAttachments)
      .values({ purchaseOrderId, attachmentKey: data.key, attachmentFilename: data.filename })
      .returning({ id: purchaseOrderAttachments.id })

    revalidatePath(`/clients/orders/${purchaseOrderId}`)
    return { ok: true, id: row.id }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('addPurchaseOrderAttachment error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function removePurchaseOrderAttachment(
  attachmentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PURCHASE_ORDERS_MANAGE')

    const rows = await db
      .select({ id: purchaseOrderAttachments.id, key: purchaseOrderAttachments.attachmentKey, purchaseOrderId: purchaseOrderAttachments.purchaseOrderId })
      .from(purchaseOrderAttachments)
      .where(eq(purchaseOrderAttachments.id, attachmentId))
      .limit(1)
    if (!rows.length) return { ok: false, error: 'Allegato non trovato.' }
    const att = rows[0]

    // Vincolo: deve restare almeno 1 allegato sull'OdA
    const cnt = await db
      .select({ c: count() })
      .from(purchaseOrderAttachments)
      .where(eq(purchaseOrderAttachments.purchaseOrderId, att.purchaseOrderId))
    if (Number(cnt[0]?.c ?? 0) <= 1) {
      return { ok: false, error: 'L\'OdA deve avere almeno un allegato. Aggiungine un altro prima di rimuovere questo.' }
    }

    await db.delete(purchaseOrderAttachments).where(eq(purchaseOrderAttachments.id, attachmentId))
    deleteObject(att.key).catch((e) => console.error('R2 delete failed:', att.key, e))

    revalidatePath(`/clients/orders/${att.purchaseOrderId}`)
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('removePurchaseOrderAttachment error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}

// ─── POSITIONS ────────────────────────────────────────────────────────────────

const LineSchema = z.object({
  id:                z.string().uuid().optional(),
  externalReference: z.string().max(120).nullable().optional(),
  description:       z.string().min(1, 'Descrizione obbligatoria.').max(500),
  amount:            z.number().positive('Importo deve essere maggiore di 0.'),
  engagementId:      z.string().uuid('Commessa obbligatoria.'),
  statusId:          z.string().uuid().nullable().optional(),
})

export async function savePurchaseOrderLines(
  purchaseOrderId: string,
  lines: {
    id?: string;
    externalReference?: string | null;
    description: string;
    amount: number;
    engagementId: string;
    statusId?: string | null;
  }[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PURCHASE_ORDERS_MANAGE')

    if (!Array.isArray(lines) || lines.length === 0) {
      return { ok: false, error: 'Inserire almeno una posizione.' }
    }

    // Validazione singole righe
    const parsedLines: z.infer<typeof LineSchema>[] = []
    for (const l of lines) {
      const p = LineSchema.safeParse(l)
      if (!p.success) return { ok: false, error: p.error.errors[0].message }
      parsedLines.push(p.data)
    }

    // Recupera testata OdA + verifica esistenza + almeno 1 allegato
    const headRows = await db
      .select({ totalAmount: purchaseOrders.totalAmount, clientId: purchaseOrders.clientId })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, purchaseOrderId))
      .limit(1)
    if (!headRows.length) return { ok: false, error: 'OdA non trovato.' }
    const head = headRows[0]

    const attCount = await db
      .select({ c: count() })
      .from(purchaseOrderAttachments)
      .where(eq(purchaseOrderAttachments.purchaseOrderId, purchaseOrderId))
    if (Number(attCount[0]?.c ?? 0) === 0) {
      return { ok: false, error: 'L\'OdA deve avere almeno un allegato prima di poter inserire le posizioni.' }
    }

    // Verifica somma posizioni
    const sumAmount = parsedLines.reduce((s, l) => s + l.amount, 0)
    const totalAmount = Number(head.totalAmount)
    if (Math.abs(sumAmount - totalAmount) > 0.01) {
      return {
        ok: false,
        error: `La somma delle posizioni (€${sumAmount.toFixed(2)}) non corrisponde al totale OdA (€${totalAmount.toFixed(2)}).`,
      }
    }

    // Carica le righe esistenti (id, code, engagementId) — usate sia per la
    // validazione (eccezione retro-compatibile) sia per la replace strategy.
    const existingLines = await db
      .select({
        id:           purchaseOrderLines.id,
        code:         purchaseOrderLines.code,
        engagementId: purchaseOrderLines.engagementId,
      })
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.purchaseOrderId, purchaseOrderId))

    // Verifica engagement validi (cliente, attivi, non conclusi, tipologia non NO OdA)
    const engagementIds = Array.from(new Set(parsedLines.map((l) => l.engagementId)))
    const today = new Date().toISOString().split('T')[0]
    const validEngs = await db
      .select({ id: engagements.id })
      .from(engagements)
      .innerJoin(projects,        eq(projects.id, engagements.projectId))
      .innerJoin(engagementTypes, eq(engagementTypes.id, engagements.engagementTypeId))
      .where(and(
        inArray(engagements.id, engagementIds),
        eq(projects.clientId, head.clientId),
        eq(projects.active, true),
        eq(engagementTypes.noOda, false),
        eq(engagements.conclusa, false),
        sql`${engagements.validUntil} >= ${today}`,
      ))
    const validEngIds = new Set(validEngs.map((e) => e.id))

    // Eccezione: consenti l'uso di commesse oggi NON valide ma SOLO se referenziate
    // da una riga esistente con id presente e engagementId NON cambiato rispetto al DB.
    // In questo modo le posizioni storiche con commesse poi diventate inattive
    // restano modificabili negli altri campi (descrizione, importo, stato, ecc.).
    const existingLineIdToEng = new Map(existingLines.map((l) => [l.id, l.engagementId]))
    for (const l of parsedLines) {
      const eId = l.engagementId
      if (validEngIds.has(eId)) continue
      // riga esistente con engagementId NON cambiato → consenti
      if (l.id && existingLineIdToEng.get(l.id) === eId) continue
      return { ok: false, error: 'Una o più commesse non sono valide (cliente, stato o tipologia incompatibili).' }
    }

    // Strategy: replace
    // 1) cancello le righe esistenti che non sono più nella lista (per id)
    const incomingIds = parsedLines.filter((l) => l.id).map((l) => l.id!) as string[]
    const toDelete = existingLines.filter((e) => !incomingIds.includes(e.id))
    if (toDelete.length > 0) {
      await db.delete(purchaseOrderLines).where(inArray(purchaseOrderLines.id, toDelete.map((d) => d.id)))
    }

    // 2) update righe esistenti
    for (const l of parsedLines.filter((p) => p.id)) {
      await db
        .update(purchaseOrderLines)
        .set({
          externalReference: l.externalReference?.trim() || null,
          description:       l.description.trim(),
          amount:            l.amount.toFixed(2),
          engagementId:      l.engagementId,
          statusId:          l.statusId ?? null,
        })
        .where(eq(purchaseOrderLines.id, l.id!))
    }

    // 3) insert nuove righe (genero codice progressivo a 3 cifre per ognuna)
    const newLines = parsedLines.filter((p) => !p.id)
    if (newLines.length > 0) {
      // Calcola maxCode tra le righe esistenti rimaste (escluse quelle eliminate)
      const remainingCodes = existingLines
        .filter((e) => incomingIds.includes(e.id))
        .map((e) => parseInt(e.code, 10) || 0)
      let maxCode = remainingCodes.reduce((m, n) => Math.max(m, n), 0)

      const inserts = newLines.map((l) => {
        maxCode += 1
        return {
          purchaseOrderId,
          code:              String(maxCode).padStart(3, '0'),
          externalReference: l.externalReference?.trim() || null,
          description:       l.description.trim(),
          amount:            l.amount.toFixed(2),
          engagementId:      l.engagementId,
          statusId:          l.statusId ?? null,
        }
      })
      await db.insert(purchaseOrderLines).values(inserts)
    }

    // Riallineamento needsReview: se la somma quadra → false
    await db
      .update(purchaseOrders)
      .set({ needsReview: false, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, purchaseOrderId))

    revalidatePath(`/clients/orders/${purchaseOrderId}`)
    revalidatePath('/clients/orders')
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('savePurchaseOrderLines error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}

// ─── SOLLECITO ────────────────────────────────────────────────────────────────

export type ResponsibleWithOpenOrders = {
  responsibleId:    string
  responsibleName:  string
  responsibleEmail: string
  ordersCount:      number
}

/** Restituisce i responsabili che hanno almeno un'OdA senza posizioni, con il conteggio. */
export async function getResponsiblesWithOpenOrders(): Promise<ResponsibleWithOpenOrders[]> {
  const session = await auth()
  requireSection(session, 'PURCHASE_ORDERS_VIEW')

  const rows = await db
    .select({
      responsibleId: purchaseOrders.responsibleUserId,
      firstName:     users.firstName,
      lastName:      users.lastName,
      email:         users.email,
      poId:          purchaseOrders.id,
      hasLines:      sql<number>`(select count(*) from ${purchaseOrderLines} where ${purchaseOrderLines.purchaseOrderId} = ${purchaseOrders.id})`,
    })
    .from(purchaseOrders)
    .innerJoin(users, eq(users.id, purchaseOrders.responsibleUserId))

  const map = new Map<string, ResponsibleWithOpenOrders>()
  for (const r of rows) {
    if (Number(r.hasLines) > 0) continue
    if (!map.has(r.responsibleId)) {
      map.set(r.responsibleId, {
        responsibleId:    r.responsibleId,
        responsibleName:  `${r.lastName} ${r.firstName}`,
        responsibleEmail: r.email,
        ordersCount:      0,
      })
    }
    map.get(r.responsibleId)!.ordersCount += 1
  }

  return Array.from(map.values()).sort((a, b) => a.responsibleName.localeCompare(b.responsibleName))
}

/** Invia email di sollecito ai responsabili indicati con l'elenco delle loro OdA pendenti. */
export async function sendPurchaseOrderReminders(
  responsibleIds: string[],
): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PURCHASE_ORDERS_MANAGE')

    if (!Array.isArray(responsibleIds) || responsibleIds.length === 0) {
      return { ok: false, error: 'Nessun responsabile selezionato.' }
    }

    // Recupera tutte le OdA dei responsabili indicati
    const rows = await db
      .select({
        poId:          purchaseOrders.id,
        code:          purchaseOrders.code,
        number:        purchaseOrders.number,
        date:          purchaseOrders.date,
        totalAmount:   purchaseOrders.totalAmount,
        clientName:    clients.name,
        responsibleId: purchaseOrders.responsibleUserId,
        respFirst:     users.firstName,
        respLast:      users.lastName,
        respEmail:     users.email,
        linesCount:    sql<number>`(select count(*) from ${purchaseOrderLines} where ${purchaseOrderLines.purchaseOrderId} = ${purchaseOrders.id})`,
      })
      .from(purchaseOrders)
      .innerJoin(clients, eq(clients.id, purchaseOrders.clientId))
      .innerJoin(users,   eq(users.id,   purchaseOrders.responsibleUserId))
      .where(inArray(purchaseOrders.responsibleUserId, responsibleIds))
      .orderBy(asc(purchaseOrders.date))

    type Pending = { id: string; code: string; number: string; clientName: string; totalAmount: string; date: string }
    type Group   = { email: string; name: string; orders: Pending[] }
    const grouped = new Map<string, Group>()

    for (const r of rows) {
      if (Number(r.linesCount) > 0) continue
      if (!grouped.has(r.responsibleId)) {
        grouped.set(r.responsibleId, {
          email:  r.respEmail,
          name:   `${r.respFirst} ${r.respLast}`,
          orders: [],
        })
      }
      grouped.get(r.responsibleId)!.orders.push({
        id:          r.poId,
        code:        r.code,
        number:      r.number,
        clientName:  r.clientName,
        totalAmount: r.totalAmount,
        date:        r.date,
      })
    }

    let sent = 0
    for (const g of Array.from(grouped.values())) {
      if (g.orders.length === 0) continue
      // Fire-and-forget: aspettiamo solo per contare i tentativi
      try {
        await sendPurchaseOrderReminderEmail({
          userEmail:     g.email,
          userName:      g.name,
          pendingOrders: g.orders,
        })
        sent += 1
      } catch (e) {
        console.error('reminder email failed for', g.email, e)
      }
    }

    return { ok: true, sent }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('sendPurchaseOrderReminders error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}
