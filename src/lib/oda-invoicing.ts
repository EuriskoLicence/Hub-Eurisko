/**
 * Importi fatturati per posizione OdA, letti dalla sezione Fatturazione.
 * Condiviso dai report "Lista OdA" e "OdA per commessa".
 *
 * Il chiamante DEVE aver verificato il permesso INVOICES_VIEW prima di
 * chiamare `getInvoicedByOdaLine`: questo modulo non fa controlli di accesso.
 */

import { db } from '@/db'
import { invoices, invoiceLines } from '@/db/schema'
import { and, eq, isNotNull, sql } from 'drizzle-orm'

export type OdaLineInvoicing = {
  invoiced:   number    // fatture in positivo, note credito in negativo, IVA esclusa
  docs:       number    // n. documenti distinti abbinati
  currencies: string[]  // divise dei documenti abbinati
}

/** Fatturato per posizione OdA (chiave: purchase_order_lines.id). */
export async function getInvoicedByOdaLine(): Promise<Map<string, OdaLineInvoicing>> {
  const rows = await db
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

  const byLine = new Map<string, OdaLineInvoicing>()
  for (const r of rows) {
    if (!r.polId) continue
    byLine.set(r.polId, {
      invoiced:   Number(r.invoiced),
      docs:       Number(r.docs),
      currencies: r.currencies ? r.currencies.split(',') : [],
    })
  }
  return byLine
}

export type OdaLineInvoicingFields = {
  invoicedAmount:    number | null  // null se la riga non ha posizione o i dati non sono visibili
  residualAmount:    number | null  // importo posizione − fatturato
  invoiceDocs:       number
  invoiceCurrencies: string[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Campi fatturazione di una riga report.
 * `byLine` = null quando l'utente non ha INVOICES_VIEW → importi null.
 */
export function invoicingFieldsFor(
  lineId: string | null,
  amount: string | null,
  byLine: Map<string, OdaLineInvoicing> | null,
): OdaLineInvoicingFields {
  if (!byLine || !lineId) {
    return { invoicedAmount: null, residualAmount: null, invoiceDocs: 0, invoiceCurrencies: [] }
  }
  const inv            = byLine.get(lineId)
  const invoicedAmount = round2(inv?.invoiced ?? 0)
  return {
    invoicedAmount,
    residualAmount:    amount !== null ? round2(Number(amount) - invoicedAmount) : null,
    invoiceDocs:       inv?.docs ?? 0,
    invoiceCurrencies: inv?.currencies ?? [],
  }
}
