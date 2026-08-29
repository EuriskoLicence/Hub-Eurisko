import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx-js-style'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getMonthlyHoursReport } from '../actions'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !hasSection(session, 'CLIENTS_VIEW')) {
    return new NextResponse('Non autorizzato', { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const now = new Date()

  const fromYear  = parseInt(searchParams.get('fromYear')  ?? String(now.getFullYear() - 1))
  const fromMonth = parseInt(searchParams.get('fromMonth') ?? '1')
  const toYear    = parseInt(searchParams.get('toYear')    ?? String(now.getFullYear()))
  const toMonth   = parseInt(searchParams.get('toMonth')   ?? String(now.getMonth() + 1))

  const responsibleId = searchParams.get('responsibleId') || null
  const clientId      = searchParams.get('clientId')      || null
  const projectId     = searchParams.get('projectId')     || null
  const engagementId  = searchParams.get('engagementId')  || null
  const userId        = searchParams.get('userId')        || null

  const { months, rows, monthTotals, grandTotal } = await getMonthlyHoursReport({
    fromYear, fromMonth, toYear, toMonth,
    responsibleId, clientId, projectId, engagementId, userId,
  })

  const headers = [
    'Cliente',
    'Progetto',
    'Responsabile progetto',
    'Commessa',
    'Codice',
    'Utente',
    ...months.map((m) => m.label),
    'Totale ore',
  ]

  // Celle mese come numeri (Excel deve poterle sommare); 0/assente → cella vuota
  const dataRows: (string | number)[][] = rows.map((r) => [
    r.clientName,
    r.projectName,
    r.projectManagerName,
    r.engagementName,
    r.compositeCode,
    r.userName,
    ...months.map((m) => r.hoursByMonth[m.key] ?? ''),
    r.totalHours,
  ])

  const totalsRow: (string | number)[] = [
    'Totali', '', '', '', '', '',
    ...months.map((m) => monthTotals[m.key] ?? 0),
    grandTotal,
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows, totalsRow])

  const headerStyle = {
    font:      { bold: true, color: { rgb: 'FFFFFF' } },
    fill:      { fgColor: { rgb: '374151' } },
    alignment: { horizontal: 'center' },
  }
  for (let c = 0; c < headers.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[cellRef]) ws[cellRef].s = headerStyle
  }

  // Riga totali in grassetto con sfondo chiaro
  const totalsRowIdx = dataRows.length + 1
  const totalsStyle = {
    font: { bold: true },
    fill: { fgColor: { rgb: 'F3F4F6' } },
  }
  for (let c = 0; c < headers.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: totalsRowIdx, c })
    if (ws[cellRef]) ws[cellRef].s = totalsStyle
  }

  ws['!cols'] = [
    { wch: 28 }, // Cliente
    { wch: 30 }, // Progetto
    { wch: 26 }, // Responsabile progetto
    { wch: 32 }, // Commessa
    { wch: 16 }, // Codice
    { wch: 26 }, // Utente
    ...months.map(() => ({ wch: 10 })),
    { wch: 12 }, // Totale ore
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Ore mensili')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const pad      = (n: number) => String(n).padStart(2, '0')
  const filename = `ore-mensili-${fromYear}${pad(fromMonth)}-${toYear}${pad(toMonth)}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
