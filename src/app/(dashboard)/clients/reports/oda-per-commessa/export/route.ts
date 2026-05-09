import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx-js-style'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getOdaPerCommessaReport } from '../actions'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !hasSection(session, 'PURCHASE_ORDERS_VIEW')) {
    return new NextResponse('Non autorizzato', { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const clientId  = searchParams.get('clientId')  || null
  const projectId = searchParams.get('projectId') || null

  const rows = await getOdaPerCommessaReport({ clientId, projectId })

  const headers = [
    'Cod. cliente',
    'Cliente',
    'Cod. progetto',
    'Progetto',
    'Cod. commessa',
    'Commessa',
    'Tipologia',
    'Conclusa',
    'Cod. OdA',
    'N° OdA cliente',
    'Data OdA',
    'Responsabile OdA',
    'Cod. posizione',
    'Riferimento esterno',
    'Descrizione posizione',
    'Importo posizione',
  ]

  const dataRows: (string | number)[][] = rows.map((r) => [
    r.clientCode,
    r.clientName,
    r.projectCode,
    r.projectName,
    r.engagementCode,
    r.engagementName,
    r.engagementTypeName,
    r.conclusa ? 'Sì' : 'No',
    r.poCode             ?? '',
    r.poNumber           ?? '',
    r.poDate             ? new Date(r.poDate + 'T00:00:00').toLocaleDateString('it-IT') : '',
    r.responsibleName    ?? '',
    r.lineCode           ?? '',
    r.externalReference  ?? '',
    r.description        ?? '',
    r.amount             !== null ? Number(r.amount) : '',
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

  // Format EUR per importo posizione (col 15)
  for (let r = 1; r <= rows.length; r++) {
    const ref = XLSX.utils.encode_cell({ r, c: 15 })
    if (ws[ref] && typeof ws[ref].v === 'number') {
      ws[ref].z = '#,##0.00 "€"'
    }
  }

  // Evidenzia righe senza OdA (testo grigio italics non disponibile in xlsx-js-style facilmente, uso colore leggero)
  rows.forEach((r, rowIdx) => {
    if (!r.poCode) {
      const ref = XLSX.utils.encode_cell({ r: rowIdx + 1, c: 8 })
      if (ws[ref]) ws[ref].s = { font: { color: { rgb: 'D97706' }, italic: true } }
    }
  })

  ws['!cols'] = [
    { wch: 12 }, // Cod. cliente
    { wch: 28 }, // Cliente
    { wch: 13 }, // Cod. progetto
    { wch: 28 }, // Progetto
    { wch: 13 }, // Cod. commessa
    { wch: 28 }, // Commessa
    { wch: 18 }, // Tipologia
    { wch:  9 }, // Conclusa
    { wch: 10 }, // Cod. OdA
    { wch: 14 }, // N° OdA cliente
    { wch: 11 }, // Data OdA
    { wch: 24 }, // Responsabile
    { wch: 11 }, // Cod. pos.
    { wch: 18 }, // Rif. esterno
    { wch: 32 }, // Descrizione
    { wch: 14 }, // Importo
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
