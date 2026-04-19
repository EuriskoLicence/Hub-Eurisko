import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx-js-style'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { requireSection } from '@/lib/permissions/auth-helpers'
import { db } from '@/db'
import { timesheetEntries, engagements, projects, clients, absenceTypes } from '@/db/schema'

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

export async function GET(req: NextRequest) {
  const session = await auth()
  requireSection(session, 'TIMESHEET')
  const userId = session.user.id

  const { searchParams } = req.nextUrl
  const year  = parseInt(searchParams.get('year')  ?? '')
  const month = parseInt(searchParams.get('month') ?? '')
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Parametri non validi.' }, { status: 400 })
  }

  const entries = await db
    .select({
      day:              timesheetEntries.day,
      hours:            timesheetEntries.hours,
      engagementName:   engagements.name,
      projectName:      projects.name,
      clientName:       clients.name,
      absenceTypeLabel: absenceTypes.label,
    })
    .from(timesheetEntries)
    .leftJoin(engagements,  eq(timesheetEntries.engagementId,  engagements.id))
    .leftJoin(projects,     eq(engagements.projectId,          projects.id))
    .leftJoin(clients,      eq(projects.clientId,              clients.id))
    .leftJoin(absenceTypes, eq(timesheetEntries.absenceTypeId, absenceTypes.id))
    .where(and(
      eq(timesheetEntries.userId, userId),
      eq(timesheetEntries.year,   year),
      eq(timesheetEntries.month,  month),
    ))
    .orderBy(timesheetEntries.day)

  const periodoLabel = `${IT_MONTHS[month - 1]} ${year}`
  const headers = ['Periodo', 'Data', 'Commessa', 'Voce assenza', 'Ore']

  const dataRows = entries.map((e) => {
    const dd   = String(e.day).padStart(2, '0')
    const mm   = String(month).padStart(2, '0')
    const comm = e.engagementName
      ? `${e.clientName} — ${e.projectName} — ${e.engagementName}`
      : ''
    return [periodoLabel, `${dd}/${mm}/${year}`, comm, e.absenceTypeLabel ?? '', e.hours]
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])

  const hStyle = {
    font:      { bold: true, color: { rgb: 'FFFFFF' } },
    fill:      { fgColor: { rgb: '374151' } },
    alignment: { horizontal: 'center' },
  }
  for (let c = 0; c < headers.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[ref]) ws[ref].s = hStyle
  }
  ws['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 50 }, { wch: 22 }, { wch: 8 }]

  XLSX.utils.book_append_sheet(wb, ws, 'Consuntivazione')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="consuntivazione_${IT_MONTHS[month-1].toLowerCase()}_${year}.xlsx"`,
    },
  })
}
