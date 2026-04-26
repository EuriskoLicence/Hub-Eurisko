import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx-js-style'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getCommessaList, type ActiveFilter } from '../actions'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !hasSection(session, 'CLIENTS_VIEW')) {
    return new NextResponse('Non autorizzato', { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const clientId  = searchParams.get('clientId')  || null
  const projectId = searchParams.get('projectId') || null
  const activeOnly = (searchParams.get('activeOnly') ?? 'all') as ActiveFilter

  const rows = await getCommessaList({ clientId, projectId, activeOnly })

  const headers = [
    'Cod. cliente',
    'Cliente',
    'Cod. progetto',
    'Progetto',
    'Responsabile progetto',
    'Cod. commessa',
    'Commessa',
    'Attiva',
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
    r.active ? 'Sì' : 'No',
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

  // Stile rosso per ore rimanenti negative e per date fine validità già scadute
  rows.forEach((r, rowIdx) => {
    if (r.remainingHours !== null && r.remainingHours < 0) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 1, c: 11 })
      if (ws[cellRef]) {
        ws[cellRef].s = { font: { color: { rgb: 'DC2626' }, bold: true } }
      }
    }
    if (r.validUntil !== '2999-12-31' && new Date(r.validUntil + 'T00:00:00') < new Date()) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 1, c: 8 })
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
    { wch: 10 }, // Attiva
    { wch: 14 }, // Fine validità
    { wch: 12 }, // Ore budget
    { wch: 16 }, // Ore consuntivate
    { wch: 14 }, // Ore rimanenti
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Lista commesse')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const suffix = activeOnly === 'active' ? '-attive' : activeOnly === 'inactive' ? '-inattive' : ''
  const filename = `lista-commesse${suffix}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
