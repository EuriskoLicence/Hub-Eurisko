'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql, asc, count } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  invoices, invoiceAttachments, invoiceLines,
  clients, purchaseOrders, purchaseOrderLines, purchaseOrderLineStatuses,
} from '@/db/schema'
import { requireSection, HttpError } from '@/lib/permissions/auth-helpers'
import { deleteObject } from '@/lib/r2'
import { z } from 'zod'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvoiceType = 'invoice' | 'credit_note'

export type InvoiceRow = {
  id:               string
  clientId:         string
  clientName:       string
  documentDate:     string   // YYYY-MM-DD
  documentNumber:   string
  type:             InvoiceType
  currency:         string
  totalAmount:      string
  vatAmount:        string
  linesCount:       number
  linesSum:         number   // somma importi posizioni (IVA esclusa)
  attachmentsCount: number
  isBalanced:       boolean  // sum(lines) == totalAmount - vatAmount (epsilon 0.01)
}

export type InvoiceDetail = {
  id:             string
  clientId:       string
  clientName:     string
  documentDate:   string
  documentNumber: string
  type:           InvoiceType
  currency:       string
  totalAmount:    string
  vatAmount:      string
  headerText:     string | null
  attachments: { id: string; key: string; filename: string; uploadedAt: string }[]
  lines: {
    id:                    string
    lineNumber:            number
    isOdaRelated:          boolean
    isTravelReimbursement: boolean
    description:           string
    amount:                string
    purchaseOrderLineId:   string | null
    odaLineLabel:          string | null  // "OdA {code}/{lineCode} — {descr}"
  }[]
}

export type OdaLineOption = { id: string; label: string; inactive?: boolean }

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getInvoices(filters?: {
  clientId?:       string
  type?:           InvoiceType
  onlyUnbalanced?: boolean
}): Promise<InvoiceRow[]> {
  const session = await auth()
  requireSection(session, 'INVOICES_VIEW')

  const conditions: any[] = []
  if (filters?.clientId) conditions.push(eq(invoices.clientId, filters.clientId))
  if (filters?.type)     conditions.push(eq(invoices.type, filters.type))
  const where = conditions.length === 0 ? undefined
              : conditions.length === 1 ? conditions[0]
              :                            and(...conditions)

  const rows = await db
    .select({
      id:               invoices.id,
      clientId:         invoices.clientId,
      clientName:       clients.name,
      documentDate:     invoices.documentDate,
      documentNumber:   invoices.documentNumber,
      type:             invoices.type,
      currency:         invoices.currency,
      totalAmount:      invoices.totalAmount,
      vatAmount:        invoices.vatAmount,
      linesCount:       sql<number>`cast((select count(*) from ${invoiceLines} where ${invoiceLines.invoiceId} = ${invoices.id}) as int)`,
      linesSum:         sql<string>`(select coalesce(sum(${invoiceLines.amount}), 0) from ${invoiceLines} where ${invoiceLines.invoiceId} = ${invoices.id})`,
      attachmentsCount: sql<number>`cast((select count(*) from ${invoiceAttachments} where ${invoiceAttachments.invoiceId} = ${invoices.id}) as int)`,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(where)
    .orderBy(sql`${invoices.documentDate} DESC`, sql`${invoices.documentNumber} DESC`)

  let mapped: InvoiceRow[] = rows.map((r) => {
    const linesSum = Number(r.linesSum)
    const expected = Number(r.totalAmount) - Number(r.vatAmount)
    return {
      id:               r.id,
      clientId:         r.clientId,
      clientName:       r.clientName,
      documentDate:     r.documentDate,
      documentNumber:   r.documentNumber,
      type:             r.type,
      currency:         r.currency,
      totalAmount:      r.totalAmount,
      vatAmount:        r.vatAmount,
      linesCount:       Number(r.linesCount),
      linesSum,
      attachmentsCount: Number(r.attachmentsCount),
      isBalanced:       Number(r.linesCount) > 0 && Math.abs(linesSum - expected) <= 0.01,
    }
  })

  if (filters?.onlyUnbalanced) mapped = mapped.filter((r) => !r.isBalanced)
  return mapped
}

export async function getInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
  const session = await auth()
  requireSection(session, 'INVOICES_VIEW')

  const headRows = await db
    .select({
      id:             invoices.id,
      clientId:       invoices.clientId,
      clientName:     clients.name,
      documentDate:   invoices.documentDate,
      documentNumber: invoices.documentNumber,
      type:           invoices.type,
      currency:       invoices.currency,
      totalAmount:    invoices.totalAmount,
      vatAmount:      invoices.vatAmount,
      headerText:     invoices.headerText,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(eq(invoices.id, id))
    .limit(1)

  if (!headRows.length) return null
  const h = headRows[0]

  const attRows = await db
    .select()
    .from(invoiceAttachments)
    .where(eq(invoiceAttachments.invoiceId, id))
    .orderBy(asc(invoiceAttachments.uploadedAt))

  const lineRows = await db
    .select({
      id:                    invoiceLines.id,
      lineNumber:            invoiceLines.lineNumber,
      isOdaRelated:          invoiceLines.isOdaRelated,
      isTravelReimbursement: invoiceLines.isTravelReimbursement,
      description:           invoiceLines.description,
      amount:                invoiceLines.amount,
      purchaseOrderLineId:   invoiceLines.purchaseOrderLineId,
      polCode:               purchaseOrderLines.code,
      polDescription:        purchaseOrderLines.description,
      poCode:                purchaseOrders.code,
    })
    .from(invoiceLines)
    .leftJoin(purchaseOrderLines, eq(purchaseOrderLines.id, invoiceLines.purchaseOrderLineId))
    .leftJoin(purchaseOrders,     eq(purchaseOrders.id, purchaseOrderLines.purchaseOrderId))
    .where(eq(invoiceLines.invoiceId, id))
    .orderBy(asc(invoiceLines.lineNumber))

  return {
    id:             h.id,
    clientId:       h.clientId,
    clientName:     h.clientName,
    documentDate:   h.documentDate,
    documentNumber: h.documentNumber,
    type:           h.type,
    currency:       h.currency,
    totalAmount:    h.totalAmount,
    vatAmount:      h.vatAmount,
    headerText:     h.headerText,
    attachments: attRows.map((a) => ({
      id:         a.id,
      key:        a.attachmentKey,
      filename:   a.attachmentFilename,
      uploadedAt: a.uploadedAt.toISOString(),
    })),
    lines: lineRows.map((l) => ({
      id:                    l.id,
      lineNumber:            l.lineNumber,
      isOdaRelated:          l.isOdaRelated,
      isTravelReimbursement: l.isTravelReimbursement,
      description:           l.description,
      amount:                l.amount,
      purchaseOrderLineId:   l.purchaseOrderLineId,
      odaLineLabel:          l.poCode ? `OdA ${l.poCode}/${l.polCode} — ${l.polDescription}` : null,
    })),
  }
}

/**
 * Posizioni OdA del cliente selezionabili per l'abbinamento delle posizioni fattura.
 * Whitelist: SOLO posizioni con stato 'AUT' o 'PAR' (le posizioni senza stato o
 * con altri stati, es. 'INV', sono escluse).
 * NOTA: ulteriori filtri (es. residuo da fatturare) da definire in seguito.
 */
export async function getOdaLinesForClient(clientId: string): Promise<OdaLineOption[]> {
  const session = await auth()
  requireSection(session, 'INVOICES_VIEW')

  const rows = await db
    .select({
      id:          purchaseOrderLines.id,
      lineCode:    purchaseOrderLines.code,
      description: purchaseOrderLines.description,
      amount:      purchaseOrderLines.amount,
      poCode:      purchaseOrders.code,
    })
    .from(purchaseOrderLines)
    .innerJoin(purchaseOrders,            eq(purchaseOrders.id, purchaseOrderLines.purchaseOrderId))
    .innerJoin(purchaseOrderLineStatuses, eq(purchaseOrderLineStatuses.id, purchaseOrderLines.statusId))
    .where(and(
      eq(purchaseOrders.clientId, clientId),
      sql`${purchaseOrderLineStatuses.code} IN ('AUT', 'PAR')`,
    ))
    .orderBy(asc(purchaseOrders.code), asc(purchaseOrderLines.code))

  return rows.map((r) => ({
    id:    r.id,
    label: `OdA ${r.poCode}/${r.lineCode} — ${r.description} (€ ${Number(r.amount).toFixed(2)})`,
  }))
}

/**
 * Posizioni OdA già abbinate a righe di QUESTA fattura ma oggi escluse dal
 * dropdown (stato assente o diverso da AUT/PAR). Servono per mostrare
 * correttamente le righe storiche nel grid (opzione visibile ma disabilitata).
 */
export async function getReferencedUnselectableOdaLines(invoiceId: string): Promise<OdaLineOption[]> {
  const session = await auth()
  requireSection(session, 'INVOICES_VIEW')

  const rows = await db
    .selectDistinct({
      id:          purchaseOrderLines.id,
      lineCode:    purchaseOrderLines.code,
      description: purchaseOrderLines.description,
      amount:      purchaseOrderLines.amount,
      poCode:      purchaseOrders.code,
      statusCode:  purchaseOrderLineStatuses.code,
    })
    .from(invoiceLines)
    .innerJoin(purchaseOrderLines, eq(purchaseOrderLines.id, invoiceLines.purchaseOrderLineId))
    .innerJoin(purchaseOrders,     eq(purchaseOrders.id, purchaseOrderLines.purchaseOrderId))
    .leftJoin (purchaseOrderLineStatuses, eq(purchaseOrderLineStatuses.id, purchaseOrderLines.statusId))
    .where(and(
      eq(invoiceLines.invoiceId, invoiceId),
      sql`(${purchaseOrderLineStatuses.code} IS NULL OR ${purchaseOrderLineStatuses.code} NOT IN ('AUT', 'PAR'))`,
    ))

  return rows.map((r) => ({
    id:       r.id,
    label:    `OdA ${r.poCode}/${r.lineCode} — ${r.description} (€ ${Number(r.amount).toFixed(2)}) [${r.statusCode ?? 'Senza stato'}]`,
    inactive: true,
  }))
}

// ─── WRITE ────────────────────────────────────────────────────────────────────

const CreateInvoiceSchema = z.object({
  id:             z.string().uuid().optional(), // pre-generato client-side per allineare path R2 allegati
  clientId:       z.string().uuid('Cliente obbligatorio.'),
  documentDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida.'),
  documentNumber: z.string().min(1, 'Numero documento obbligatorio.').max(80),
  type:           z.enum(['invoice', 'credit_note']),
  currency:       z.string().min(3).max(3),
  totalAmount:    z.number({ invalid_type_error: 'Importo non valido.' }),
  vatAmount:      z.number({ invalid_type_error: 'IVA non valida.' }),
  headerText:     z.string().max(2000).optional().nullable(),
  attachments:    z.array(z.object({
                    key:      z.string().min(1),
                    filename: z.string().min(1).max(255),
                  })),  // anche [] — allegati facoltativi
})

export async function createInvoice(
  data: {
    id?: string
    clientId: string; documentDate: string; documentNumber: string
    type: InvoiceType; currency: string
    totalAmount: number; vatAmount: number
    headerText?: string | null
    attachments: { key: string; filename: string }[]
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'INVOICES_MANAGE')

    const parsed = CreateInvoiceSchema.safeParse(data)
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message }

    // Le key degli allegati devono appartenere al prefisso dell'id pre-generato
    if (parsed.data.id) {
      const prefix = `invoices/${parsed.data.id}/`
      for (const a of parsed.data.attachments) {
        if (!a.key.startsWith(prefix)) {
          return { ok: false, error: 'Allegato con percorso non valido.' }
        }
      }
    }

    const insertValues: any = {
      clientId:       parsed.data.clientId,
      documentDate:   parsed.data.documentDate,
      documentNumber: parsed.data.documentNumber.trim(),
      type:           parsed.data.type,
      currency:       parsed.data.currency.toUpperCase(),
      totalAmount:    parsed.data.totalAmount.toFixed(2),
      vatAmount:      parsed.data.vatAmount.toFixed(2),
      headerText:     parsed.data.headerText?.trim() || null,
    }
    if (parsed.data.id) insertValues.id = parsed.data.id

    const [row] = await db.insert(invoices).values(insertValues).returning({ id: invoices.id })

    if (parsed.data.attachments.length > 0) {
      await db.insert(invoiceAttachments).values(
        parsed.data.attachments.map((a) => ({
          invoiceId:          row.id,
          attachmentKey:      a.key,
          attachmentFilename: a.filename,
        })),
      )
    }

    revalidatePath('/clients/invoices')
    revalidatePath(`/clients/invoices/${row.id}`)
    return { ok: true, id: row.id }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('createInvoice error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}

const UpdateInvoiceSchema = z.object({
  clientId:       z.string().uuid().optional(),
  documentDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  documentNumber: z.string().min(1).max(80).optional(),
  type:           z.enum(['invoice', 'credit_note']).optional(),
  currency:       z.string().min(3).max(3).optional(),
  totalAmount:    z.number().optional(),
  vatAmount:      z.number().optional(),
  headerText:     z.string().max(2000).nullable().optional(),
})

export async function updateInvoice(
  id: string,
  data: {
    clientId?: string; documentDate?: string; documentNumber?: string
    type?: InvoiceType; currency?: string
    totalAmount?: number; vatAmount?: number
    headerText?: string | null
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'INVOICES_MANAGE')

    const parsed = UpdateInvoiceSchema.safeParse(data)
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message }

    const existingRows = await db
      .select({ clientId: invoices.clientId })
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1)
    if (!existingRows.length) return { ok: false, error: 'Fattura non trovata.' }

    // Cambio cliente bloccato se esistono posizioni (gli abbinamenti OdA sono per-cliente)
    if (parsed.data.clientId && parsed.data.clientId !== existingRows[0].clientId) {
      const cnt = await db
        .select({ c: count() })
        .from(invoiceLines)
        .where(eq(invoiceLines.invoiceId, id))
      if (Number(cnt[0]?.c ?? 0) > 0) {
        return { ok: false, error: 'Non puoi cambiare cliente: la fattura ha già posizioni. Eliminale prima di cambiare cliente.' }
      }
    }

    const set: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.clientId !== undefined)       set.clientId = parsed.data.clientId
    if (parsed.data.documentDate !== undefined)   set.documentDate = parsed.data.documentDate
    if (parsed.data.documentNumber !== undefined) set.documentNumber = parsed.data.documentNumber.trim()
    if (parsed.data.type !== undefined)           set.type = parsed.data.type
    if (parsed.data.currency !== undefined)       set.currency = parsed.data.currency.toUpperCase()
    if (parsed.data.totalAmount !== undefined)    set.totalAmount = parsed.data.totalAmount.toFixed(2)
    if (parsed.data.vatAmount !== undefined)      set.vatAmount = parsed.data.vatAmount.toFixed(2)
    if (parsed.data.headerText !== undefined)     set.headerText = parsed.data.headerText?.trim() || null

    await db.update(invoices).set(set).where(eq(invoices.id, id))

    revalidatePath('/clients/invoices')
    revalidatePath(`/clients/invoices/${id}`)
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('updateInvoice error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}

/**
 * Eliminazione SEMPRE consentita (richiesta esplicita): cascade su posizioni
 * e allegati (FK ON DELETE CASCADE) + cleanup best-effort dei file R2.
 */
export async function deleteInvoice(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'INVOICES_MANAGE')

    const atts = await db
      .select({ key: invoiceAttachments.attachmentKey })
      .from(invoiceAttachments)
      .where(eq(invoiceAttachments.invoiceId, id))

    const deleted = await db.delete(invoices).where(eq(invoices.id, id)).returning({ id: invoices.id })
    if (deleted.length === 0) return { ok: false, error: 'Fattura non trovata.' }

    for (const a of atts) {
      deleteObject(a.key).catch((e) => console.error('R2 delete failed:', a.key, e))
    }

    revalidatePath('/clients/invoices')
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('deleteInvoice error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}

// ─── ATTACHMENTS ──────────────────────────────────────────────────────────────

export async function addInvoiceAttachment(
  invoiceId: string,
  data: { key: string; filename: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'INVOICES_MANAGE')

    const exists = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.id, invoiceId)).limit(1)
    if (!exists.length) return { ok: false, error: 'Fattura non trovata.' }

    const [row] = await db
      .insert(invoiceAttachments)
      .values({ invoiceId, attachmentKey: data.key, attachmentFilename: data.filename })
      .returning({ id: invoiceAttachments.id })

    revalidatePath(`/clients/invoices/${invoiceId}`)
    return { ok: true, id: row.id }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('addInvoiceAttachment error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function removeInvoiceAttachment(
  attachmentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'INVOICES_MANAGE')

    const rows = await db
      .select({ id: invoiceAttachments.id, key: invoiceAttachments.attachmentKey, invoiceId: invoiceAttachments.invoiceId })
      .from(invoiceAttachments)
      .where(eq(invoiceAttachments.id, attachmentId))
      .limit(1)
    if (!rows.length) return { ok: false, error: 'Allegato non trovato.' }
    const att = rows[0]

    // Nessun vincolo "min 1": gli allegati fattura sono facoltativi
    await db.delete(invoiceAttachments).where(eq(invoiceAttachments.id, attachmentId))
    deleteObject(att.key).catch((e) => console.error('R2 delete failed:', att.key, e))

    revalidatePath(`/clients/invoices/${att.invoiceId}`)
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('removeInvoiceAttachment error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}

// ─── POSITIONS ────────────────────────────────────────────────────────────────

const InvoiceLineSchema = z.object({
  id:                    z.string().uuid().optional(),
  isOdaRelated:          z.boolean(),
  isTravelReimbursement: z.boolean(),
  description:           z.string().min(1, 'Testo posizione obbligatorio.').max(500),
  amount:                z.number().refine((n) => isFinite(n) && Math.abs(n) > 0.001, 'Importo posizione non valido.'),
  purchaseOrderLineId:   z.string().uuid().nullable().optional(),
})

export async function saveInvoiceLines(
  invoiceId: string,
  lines: {
    id?: string
    isOdaRelated: boolean
    isTravelReimbursement: boolean
    description: string
    amount: number
    purchaseOrderLineId?: string | null
  }[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'INVOICES_MANAGE')

    if (!Array.isArray(lines) || lines.length === 0) {
      return { ok: false, error: 'Inserire almeno una posizione.' }
    }

    // Validazione singole righe
    const parsedLines: z.infer<typeof InvoiceLineSchema>[] = []
    for (const l of lines) {
      const p = InvoiceLineSchema.safeParse(l)
      if (!p.success) return { ok: false, error: p.error.errors[0].message }
      // Coerenza flag ↔ abbinamento
      if (p.data.isOdaRelated && !p.data.purchaseOrderLineId) {
        return { ok: false, error: 'Le posizioni riferite a OdA devono avere una posizione OdA abbinata.' }
      }
      parsedLines.push(p.data)
    }

    // Testata
    const headRows = await db
      .select({ totalAmount: invoices.totalAmount, vatAmount: invoices.vatAmount, clientId: invoices.clientId })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)
    if (!headRows.length) return { ok: false, error: 'Fattura non trovata.' }
    const head = headRows[0]

    // Quadratura unica: Σ posizioni = Totale Documento − IVA
    const sumAmount = parsedLines.reduce((s, l) => s + l.amount, 0)
    const expected  = Number(head.totalAmount) - Number(head.vatAmount)
    if (Math.abs(sumAmount - expected) > 0.01) {
      return {
        ok: false,
        error: `La somma delle posizioni (€${sumAmount.toFixed(2)}) non corrisponde a Totale Documento − IVA (€${expected.toFixed(2)}).`,
      }
    }

    // Le posizioni OdA abbinate devono appartenere a OdA dello stesso cliente
    const polIds = Array.from(new Set(
      parsedLines.map((l) => (l.isOdaRelated ? l.purchaseOrderLineId : null)).filter((id): id is string => !!id),
    ))
    if (polIds.length > 0) {
      const validPols = await db
        .select({ id: purchaseOrderLines.id })
        .from(purchaseOrderLines)
        .innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderLines.purchaseOrderId))
        .where(and(
          sql`${purchaseOrderLines.id} = ANY(ARRAY[${sql.join(polIds.map((id) => sql`${id}::uuid`), sql`, `)}])`,
          eq(purchaseOrders.clientId, head.clientId),
        ))
      const validPolIds = new Set(validPols.map((p) => p.id))
      for (const id of polIds) {
        if (!validPolIds.has(id)) {
          return { ok: false, error: 'Una o più posizioni OdA abbinate non appartengono al cliente della fattura.' }
        }
      }
    }

    // Righe esistenti (per replace strategy e numerazione progressiva)
    const existingLines = await db
      .select({ id: invoiceLines.id, lineNumber: invoiceLines.lineNumber })
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, invoiceId))

    // 1) delete righe non più in lista
    const incomingIds = parsedLines.filter((l) => l.id).map((l) => l.id!) as string[]
    const toDelete = existingLines.filter((e) => !incomingIds.includes(e.id))
    if (toDelete.length > 0) {
      await db.delete(invoiceLines).where(
        sql`${invoiceLines.id} = ANY(ARRAY[${sql.join(toDelete.map((d) => sql`${d.id}::uuid`), sql`, `)}])`,
      )
    }

    // 2) update righe esistenti
    for (const l of parsedLines.filter((p) => p.id)) {
      await db
        .update(invoiceLines)
        .set({
          isOdaRelated:          l.isOdaRelated,
          isTravelReimbursement: l.isTravelReimbursement,
          description:           l.description.trim(),
          amount:                l.amount.toFixed(2),
          purchaseOrderLineId:   l.isOdaRelated ? (l.purchaseOrderLineId ?? null) : null,
        })
        .where(eq(invoiceLines.id, l.id!))
    }

    // 3) insert nuove righe con lineNumber progressivo (continua dal max rimasto)
    const newLines = parsedLines.filter((p) => !p.id)
    if (newLines.length > 0) {
      const remainingNumbers = existingLines
        .filter((e) => incomingIds.includes(e.id))
        .map((e) => e.lineNumber)
      let maxNumber = remainingNumbers.reduce((m, n) => Math.max(m, n), 0)

      const inserts = newLines.map((l) => {
        maxNumber += 1
        return {
          invoiceId,
          lineNumber:            maxNumber,
          isOdaRelated:          l.isOdaRelated,
          isTravelReimbursement: l.isTravelReimbursement,
          description:           l.description.trim(),
          amount:                l.amount.toFixed(2),
          purchaseOrderLineId:   l.isOdaRelated ? (l.purchaseOrderLineId ?? null) : null,
        }
      })
      await db.insert(invoiceLines).values(inserts)
    }

    revalidatePath(`/clients/invoices/${invoiceId}`)
    revalidatePath('/clients/invoices')
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('saveInvoiceLines error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}
