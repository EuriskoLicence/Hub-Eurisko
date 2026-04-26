import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx-js-style'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getCommessePerUtente } from '../actions'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !hasSection(session, 'CLIENTS_VIEW')) {
    return new NextResponse('Non autorizzato', { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const userId        = searchParams.get('userId')        || null
  const engagementId  = searchParams.get('engagementId')  || null
  const responsibleId = searchParams.get('responsibleId') || null

  const rows = await getCommessePerUtente({ userId, engagementId, responsibleId })

  const headers = ['Utente', 'Commessa', 'Cod. commessa', 'Responsabile commessa']

  const dataRows: (string | number)[][] = rows.map((r) => [
    r.userName,
    r.engagementName,
    r.engagementCode,
    r.responsibleName,
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

  ws['!cols'] = [
    { wch: 30 }, // Utente
    { wch: 40 }, // Commessa
    { wch: 16 }, // Cod. commessa
    { wch: 30 }, // Responsabile
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Commesse per utente')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="commesse-per-utente.xlsx"',
    },
  })
}
