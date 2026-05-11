import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx-js-style'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getOdaListReport } from '../actions'

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
  ]

  const dataRows: (string | number)[][] = rows.map((r) => [
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

  // Format numerico EUR per colonne Importo totale (8) e Importo posizione (12)
  for (let r = 1; r <= rows.length; r++) {
    for (const c of [7, 12]) {
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
