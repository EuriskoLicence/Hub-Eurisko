import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx-js-style'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getOdaListReport } from '../actions'
import { checkCoherence, isCoherenceIssue, hasForeignCurrency } from '@/lib/oda-coherence'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !hasSection(session, 'PURCHASE_ORDERS_VIEW')) {
    return new NextResponse('Non autorizzato', { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const clientId      = searchParams.get('clientId')      || null
  const responsibleId = searchParams.get('responsibleId') || null
  const lineStatusId  = searchParams.get('lineStatusId')  || null

  const rows = await getOdaListReport({ clientId, responsibleId, lineStatusId })

  // Colonne fatturazione solo per chi ha anche il permesso fatture (stessa regola dell'action)
  const canSeeInvoicing = hasSection(session, 'INVOICES_VIEW')
  const coherence = rows.map((r) =>
    checkCoherence(r.lineStatusCode, r.amount !== null ? Number(r.amount) : null, r.invoicedAmount),
  )

  const headers = [
    'Cod. OdA',
    'N° OdA cliente',
    'Data',
    'Cod. cliente',
    'Cliente',
    'Responsabile',
    'Email responsabile',
    'Importo totale',
    'Da rivedere',
    'Cod. posizione',
    'Riferimento esterno',
    'Descrizione posizione',
    'Importo posizione',
    'Cod. progetto',
    'Progetto',
    'Cod. commessa',
    'Commessa',
    'Stato pos. (cod.)',
    'Stato pos. (descr.)',
    ...(canSeeInvoicing ? ['Importo fatturato', 'Importo da fatturare', 'Coerenza stato / fatturazione'] : []),
  ]

  // Indici delle colonne fatturazione (dopo le 19 colonne base)
  const COL_INVOICED  = 19
  const COL_RESIDUAL  = 20
  const COL_COHERENCE = 21

  const dataRows: (string | number)[][] = rows.map((r, i) => [
    r.poCode,
    r.poNumber,
    new Date(r.poDate + 'T00:00:00').toLocaleDateString('it-IT'),
    r.clientCode,
    r.clientName,
    r.responsibleName,
    r.responsibleEmail,
    Number(r.totalAmount),
    r.needsReview ? 'Sì' : 'No',
    r.lineCode            ?? '—',
    r.externalReference   ?? '',
    r.description         ?? '',
    r.amount              !== null ? Number(r.amount) : '',
    r.projectCode         ?? '',
    r.projectName         ?? '',
    r.engagementCode      ?? '',
    r.engagementName      ?? '',
    r.lineStatusCode      ?? '',
    r.lineStatusDesc      ?? '',
    ...(canSeeInvoicing
      ? [
          r.invoicedAmount !== null ? r.invoicedAmount : '',
          r.residualAmount !== null ? r.residualAmount : '',
          [
            coherence[i].label,
            hasForeignCurrency(r.invoiceCurrencies)
              ? `Divise ${r.invoiceCurrencies.join('+')} sommate senza conversione`
              : '',
          ].filter(Boolean).join(' · '),
        ]
      : []),
  ])

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])

  const headerStyle = {
    font:      { bold: true, color: { rgb: 'FFFFFF' } },
    fill:      { fgColor: { rgb: '7C3AED' } },
    alignment: { horizontal: 'center' },
  }
  for (let c = 0; c < headers.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[cellRef]) ws[cellRef].s = headerStyle
  }

  // Format numerico EUR per colonne Importo totale (8), Importo posizione (12)
  // e, se visibili, Importo fatturato / da fatturare
  const eurCols = canSeeInvoicing ? [7, 12, COL_INVOICED, COL_RESIDUAL] : [7, 12]
  for (let r = 1; r <= rows.length; r++) {
    for (const c of eurCols) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (ws[ref] && typeof ws[ref].v === 'number') {
        ws[ref].z = '#,##0.00 "€"'
      }
    }
  }

  // Evidenzia OdA "da rivedere"
  rows.forEach((r, rowIdx) => {
    if (r.needsReview) {
      const ref = XLSX.utils.encode_cell({ r: rowIdx + 1, c: 8 })
      if (ws[ref]) ws[ref].s = { font: { color: { rgb: 'DC2626' }, bold: true } }
    }
  })

  // Evidenzia incoerenze stato/fatturazione e importi da fatturare negativi
  if (canSeeInvoicing) {
    rows.forEach((r, rowIdx) => {
      const c = coherence[rowIdx]
      if (isCoherenceIssue(c)) {
        const ref = XLSX.utils.encode_cell({ r: rowIdx + 1, c: COL_COHERENCE })
        const severe = c.kind === 'over' || c.kind === 'negative'
        if (ws[ref]) ws[ref].s = {
          font: { color: { rgb: severe ? 'B91C1C' : '92400E' }, bold: true },
          fill: { fgColor: { rgb: severe ? 'FEE2E2' : 'FEF3C7' } },
        }
      }
      if (r.residualAmount !== null && r.residualAmount < -0.01) {
        const ref = XLSX.utils.encode_cell({ r: rowIdx + 1, c: COL_RESIDUAL })
        if (ws[ref]) ws[ref].s = { font: { color: { rgb: 'DC2626' }, bold: true } }
      }
    })
  }

  ws['!cols'] = [
    { wch: 10 }, // Cod. OdA
    { wch: 14 }, // N° OdA cliente
    { wch: 11 }, // Data
    { wch: 12 }, // Cod. cliente
    { wch: 28 }, // Cliente
    { wch: 24 }, // Responsabile
    { wch: 28 }, // Email
    { wch: 14 }, // Importo totale
    { wch: 11 }, // Da rivedere
    { wch: 11 }, // Cod. pos.
    { wch: 18 }, // Rif. esterno
    { wch: 32 }, // Descrizione
    { wch: 14 }, // Importo pos.
    { wch: 12 }, // Cod. progetto
    { wch: 28 }, // Progetto
    { wch: 12 }, // Cod. commessa
    { wch: 28 }, // Commessa
    { wch: 12 }, // Stato cod.
    { wch: 22 }, // Stato descr.
    ...(canSeeInvoicing
      ? [
          { wch: 16 }, // Importo fatturato
          { wch: 18 }, // Importo da fatturare
          { wch: 48 }, // Coerenza
        ]
      : []),
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Lista OdA')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const filename = 'lista-oda.xlsx'
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
