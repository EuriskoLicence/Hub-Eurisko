import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx-js-style'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getHoursReport } from '../actions'

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !hasSection(session, 'CLIENTS_VIEW')) {
    return new NextResponse('Non autorizzato', { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const year          = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month         = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
  const responsibleId = searchParams.get('responsibleId') || null
  const clientId      = searchParams.get('clientId')      || null
  const projectId     = searchParams.get('projectId')     || null
  const engagementId  = searchParams.get('engagementId')  || null
  const userId        = searchParams.get('userId')        || null

  const rows = await getHoursReport({ year, month, responsibleId, clientId, projectId, engagementId, userId })

  const periodoLabel = (m: number | null, y: number) =>
    m ? `${IT_MONTHS[m - 1]} ${y}` : `Anno ${y}`

  const headers = [
    'Cliente',
    'Progetto',
    'Responsabile progetto',
    'Commessa',
    'Codice',
    'Persona',
    'Periodo',
    'Ore standard',
    'Ore extra',
    'Totale ore',
  ]

  const dataRows: (string | number)[][] = []
  for (const eng of rows) {
    for (const u of eng.users) {
      dataRows.push([
        eng.clientName,
        eng.projectName,
        eng.projectManagerName,
        eng.engagementName,
        eng.compositeCode,
        u.userName,
        periodoLabel(month, year),
        u.standardHours,
        u.extraHours,
        u.totalHours,
      ])
    }
  }

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

  ws['!cols'] = [
    { wch: 30 }, // Cliente
    { wch: 35 }, // Progetto
    { wch: 28 }, // Responsabile progetto
    { wch: 35 }, // Commessa
    { wch: 16 }, // Codice
    { wch: 30 }, // Persona
    { wch: 14 }, // Periodo
    { wch: 14 }, // Ore standard
    { wch: 12 }, // Ore extra
    { wch: 12 }, // Totale ore
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Report ore')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const filename = month
    ? `report-ore-${IT_MONTHS[month - 1].toLowerCase()}-${year}.xlsx`
    : `report-ore-${year}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
