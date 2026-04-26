import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx-js-style'
import { and, eq, gte, sql } from 'drizzle-orm'
import { auth } from '@/auth'
import { requireSection } from '@/lib/permissions/auth-helpers'
import { db } from '@/db'
import { timesheetExtraEntries, engagements, projects, clients, engagementUsers } from '@/db/schema'

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

export async function GET(req: NextRequest) {
  const session = await auth()
  requireSection(session, 'TIMESHEET_EXTRA')

  const { searchParams } = req.nextUrl
  const year       = parseInt(searchParams.get('year')  ?? '')
  const month      = parseInt(searchParams.get('month') ?? '')
  const userIdParam = searchParams.get('userId')

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Parametri non validi.' }, { status: 400 })
  }

  let userId = session.user.id

  // Se è specificato un userId diverso, verifica che l'utente loggato sia responsabile
  if (userIdParam && userIdParam !== session.user.id) {
    const authRows = await db
      .selectDistinct({ id: engagementUsers.userId })
      .from(engagementUsers)
      .innerJoin(engagements, eq(engagementUsers.engagementId, engagements.id))
      .innerJoin(projects,    eq(engagements.projectId,        projects.id))
      .where(
        and(
          eq(projects.responsibleUserId, session.user.id),
          eq(engagementUsers.userId,     userIdParam),
          eq(projects.active,            true),
          gte(engagements.validUntil,    sql`CURRENT_DATE`),
        ),
      )
      .limit(1)
    if (authRows.length === 0) {
      return new NextResponse('Non autorizzato', { status: 403 })
    }
    userId = userIdParam
  }

  const entries = await db
    .select({
      day:            timesheetExtraEntries.day,
      hours:          timesheetExtraEntries.hours,
      engagementName: engagements.name,
      projectName:    projects.name,
      clientName:     clients.name,
    })
    .from(timesheetExtraEntries)
    .leftJoin(engagements, eq(timesheetExtraEntries.engagementId, engagements.id))
    .leftJoin(projects,    eq(engagements.projectId,              projects.id))
    .leftJoin(clients,     eq(projects.clientId,                  clients.id))
    .where(and(
      eq(timesheetExtraEntries.userId, userId),
      eq(timesheetExtraEntries.year,   year),
      eq(timesheetExtraEntries.month,  month),
    ))
    .orderBy(timesheetExtraEntries.day)

  const periodoLabel = `${IT_MONTHS[month - 1]} ${year}`
  const headers = ['Periodo', 'Data', 'Commessa', 'Ore extra']

  const dataRows = entries.map((e) => {
    const dd   = String(e.day).padStart(2, '0')
    const mm   = String(month).padStart(2, '0')
    const comm = e.engagementName
      ? `${e.clientName} — ${e.projectName} — ${e.engagementName}`
      : ''
    return [periodoLabel, `${dd}/${mm}/${year}`, comm, e.hours]
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
  ws['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 50 }, { wch: 10 }]

  XLSX.utils.book_append_sheet(wb, ws, 'Cons. extra')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="consuntivazione_extra_${IT_MONTHS[month-1].toLowerCase()}_${year}.xlsx"`,
    },
  })
}
