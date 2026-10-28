import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx-js-style'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getOdaPerCommessaReport } from '../actions'
import { checkCoherence, isCoherenceIssue, hasForeignCurrency } from '@/lib/oda-coherence'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !hasSection(session, 'PURCHASE_ORDERS_VIEW')) {
    return new NextResponse('Non autorizzato', { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const clientId  = searchParams.get('clientId')  || null
  const projectId = searchParams.get('projectId') || null
  const statusId  = searchParams.get('statusId')  || null
  const odaFilter = searchParams.get('odaFilter') || null
  const odaResponsibleId     = searchParams.get('odaResponsibleId')     || null
  const projectResponsibleId = searchParams.get('projectResponsibleId') || null

  const rows = await getOdaPerCommessaReport({
    clientId, projectId, statusId, odaFilter, odaResponsibleId, projectResponsibleId,
  })

  // Colonne fatturazione solo per chi ha anche il permesso fatture (stessa regola dell'action)
  const canSeeInvoicing = hasSection(session, 'INVOICES_VIEW')
  const coherence = rows.map((r) =>
    checkCoherence(r.lineStatusCode, r.amount !== null ? Number(r.amount) : null, r.invoicedAmount),
  )

  const headers = [
    'Cod. cliente',
    'Cliente',
    'Cod. progetto',
    'Progetto',
    'Cod. commessa',
    'Commessa',
    'Tipologia',
    'Conclusa',
    'Stato comm. (cod.)',
    'Stato comm. (descr.)',
    'Cod. OdA',
    'N° OdA cliente',
    'Data OdA',
    'Responsabile OdA',
    'Cod. posizione',
    'Riferimento esterno',
    'Descrizione posizione',
    'Importo posizione',
    'Stato pos. OdA (cod.)',
    'Stato pos. OdA (descr.)',
    ...(canSeeInvoicing ? ['Importo fatturato', 'Importo da fatturare', 'Coerenza stato / fatturazione'] : []),
  ]

  // Indici delle colonne fatturazione (dopo le 20 colonne base)
  const COL_INVOICED  = 20
  const COL_RESIDUAL  = 21
  const COL_COHERENCE = 22

  const dataRows: (string | number)[][] = rows.map((r, i) => [
    r.clientCode,
    r.clientName,
    r.projectCode,
    r.projectName,
    r.engagementCode,
    r.engagementName,
    r.engagementTypeName,
    r.conclusa ? 'Sì' : 'No',
    r.statusCode        ?? '',
    r.statusDescription ?? '',
    r.poCode             ?? '',
    r.poNumber           ?? '',
    r.poDate             ? new Date(r.poDate + 'T00:00:00').toLocaleDateString('it-IT') : '',
    r.responsibleName    ?? '',
    r.lineCode           ?? '',
    r.externalReference  ?? '',
    r.description        ?? '',
    r.amount             !== null ? Number(r.amount) : '',
    r.lineStatusCode     ?? '',
    r.lineStatusDesc     ?? '',
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
    fill:      { fgColor: { rgb: 'C026D3' } },
    alignment: { horizontal: 'center' },
  }
  for (let c = 0; c < headers.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[cellRef]) ws[cellRef].s = headerStyle
  }

  // Format EUR per importo posizione (col 17) e, se visibili, fatturato / da fatturare
  const eurCols = canSeeInvoicing ? [17, COL_INVOICED, COL_RESIDUAL] : [17]
  for (let r = 1; r <= rows.length; r++) {
    for (const c of eurCols) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (ws[ref] && typeof ws[ref].v === 'number') {
        ws[ref].z = '#,##0.00 "€"'
      }
    }
  }

  // Evidenzia righe senza OdA su Cod. OdA (col 10)
  rows.forEach((r, rowIdx) => {
    if (!r.poCode) {
      const ref = XLSX.utils.encode_cell({ r: rowIdx + 1, c: 10 })
      if (ws[ref]) ws[ref].s = { font: { color: { rgb: 'D97706' }, italic: true } }
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
    { wch: 12 }, // Cod. cliente
    { wch: 28 }, // Cliente
    { wch: 13 }, // Cod. progetto
    { wch: 28 }, // Progetto
    { wch: 13 }, // Cod. commessa
    { wch: 28 }, // Commessa
    { wch: 18 }, // Tipologia
    { wch:  9 }, // Conclusa
    { wch: 14 }, // Stato comm. (cod.)
    { wch: 24 }, // Stato comm. (descr.)
    { wch: 10 }, // Cod. OdA
    { wch: 14 }, // N° OdA cliente
    { wch: 11 }, // Data OdA
    { wch: 24 }, // Responsabile
    { wch: 11 }, // Cod. pos.
    { wch: 18 }, // Rif. esterno
    { wch: 32 }, // Descrizione
    { wch: 14 }, // Importo
    { wch: 12 }, // Stato pos. OdA (cod.)
    { wch: 22 }, // Stato pos. OdA (descr.)
    ...(canSeeInvoicing
      ? [
          { wch: 16 }, // Importo fatturato
          { wch: 18 }, // Importo da fatturare
          { wch: 48 }, // Coerenza
        ]
      : []),
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'OdA per commessa')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const filename = 'oda-per-commessa.xlsx'
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
