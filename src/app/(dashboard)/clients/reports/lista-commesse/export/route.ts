import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx-js-style'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getCommessaList, type ConclusedFilter } from '../actions'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !hasSection(session, 'CLIENTS_VIEW')) {
    return new NextResponse('Non autorizzato', { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const clientId        = searchParams.get('clientId')  || null
  const projectId       = searchParams.get('projectId') || null
  const statusId        = searchParams.get('statusId')  || null
  const conclusedFilter = (
    ['all', 'open', 'closed'].includes(searchParams.get('conclusedFilter') ?? '')
      ? (searchParams.get('conclusedFilter') as ConclusedFilter)
      : 'all'
  ) as ConclusedFilter

  const rows = await getCommessaList({ clientId, projectId, conclusedFilter, statusId })

  const headers = [
    'Cod. cliente',
    'Cliente',
    'Cod. progetto',
    'Progetto',
    'Responsabile progetto',
    'Cod. commessa',
    'Commessa',
    'Conclusa',
    'Stato (cod.)',
    'Stato (descr.)',
    'Fine validità',
    'Ore budget',
    'Ore consuntivate',
    'Ore rimanenti',
  ]

  const dataRows: (string | number)[][] = rows.map((r) => [
    r.clientCode,
    r.clientName,
    r.projectCode,
    r.projectName,
    r.responsibleName,
    r.engagementCode,
    r.engagementName,
    r.conclusa ? 'Sì' : 'No',
    r.statusCode        ?? '',
    r.statusDescription ?? '',
    r.validUntil === '2999-12-31'
      ? '—'
      : new Date(r.validUntil + 'T00:00:00').toLocaleDateString('it-IT'),
    r.totalHours     ?? '—',
    r.workedHours,
    r.remainingHours ?? '—',
  ])

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])

  const headerStyle = {
    font:      { bold: true, color: { rgb: 'FFFFFF' } },
    fill:      { fgColor: { rgb: '374151' } },
    alignment: { horizontal: 'center' },
  }
  for (let c = 0; c < headers.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[cellRef]) ws[cellRef].s = headerStyle
  }

  // Stile rosso per ore rimanenti negative (col 13) e per date fine validità già scadute (col 10)
  rows.forEach((r, rowIdx) => {
    if (r.remainingHours !== null && r.remainingHours < 0) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 1, c: 13 })
      if (ws[cellRef]) {
        ws[cellRef].s = { font: { color: { rgb: 'DC2626' }, bold: true } }
      }
    }
    if (r.validUntil !== '2999-12-31' && new Date(r.validUntil + 'T00:00:00') < new Date()) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 1, c: 10 })
      if (ws[cellRef]) {
        ws[cellRef].s = { font: { color: { rgb: 'DC2626' }, bold: true } }
      }
    }
  })

  ws['!cols'] = [
    { wch: 14 }, // Cod. cliente
    { wch: 30 }, // Cliente
    { wch: 14 }, // Cod. progetto
    { wch: 35 }, // Progetto
    { wch: 28 }, // Responsabile
    { wch: 14 }, // Cod. commessa
    { wch: 35 }, // Commessa
    { wch: 10 }, // Conclusa
    { wch: 12 }, // Stato (cod.)
    { wch: 28 }, // Stato (descr.)
    { wch: 14 }, // Fine validità
    { wch: 12 }, // Ore budget
    { wch: 16 }, // Ore consuntivate
    { wch: 14 }, // Ore rimanenti
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Lista commesse')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const suffix = conclusedFilter === 'open'   ? '-non-concluse'
              : conclusedFilter === 'closed'  ? '-concluse'
              :                                 ''
  const filename = `lista-commesse${suffix}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
