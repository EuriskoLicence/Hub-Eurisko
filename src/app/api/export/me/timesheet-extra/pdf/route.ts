import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { requireSection } from '@/lib/permissions/auth-helpers'
import { db } from '@/db'
import { timesheetExtraEntries, engagements, projects, clients, users } from '@/db/schema'
import { generatePdfTable } from '@/lib/pdf-table'

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

export async function GET(req: NextRequest) {
  const session = await auth()
  requireSection(session, 'TIMESHEET_EXTRA')
  const userId = session.user.id

  const { searchParams } = req.nextUrl
  const year  = parseInt(searchParams.get('year')  ?? '')
  const month = parseInt(searchParams.get('month') ?? '')
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Parametri non validi.' }, { status: 400 })
  }

  const [entries, userRows] = await Promise.all([
    db.select({
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
    .orderBy(timesheetExtraEntries.day),

    db.select({ firstName: users.firstName, lastName: users.lastName })
      .from(users).where(eq(users.id, userId)).limit(1),
  ])

  const userName     = userRows[0] ? `${userRows[0].firstName} ${userRows[0].lastName}` : ''
  const periodoLabel = `${IT_MONTHS[month - 1]} ${year}`

  const rows = entries.map((e) => {
    const dd   = String(e.day).padStart(2, '0')
    const mm   = String(month).padStart(2, '0')
    const comm = e.engagementName
      ? `${e.clientName} — ${e.projectName} — ${e.engagementName}`
      : ''
    return [periodoLabel, `${dd}/${mm}/${year}`, comm, e.hours]
  })

  const buffer = await generatePdfTable({
    title:   `Consuntivazione extra — ${userName} — ${periodoLabel}`,
    columns: [
      { header: 'Periodo',  width: 80  },
      { header: 'Data',     width: 55  },
      { header: 'Commessa', width: 340 },
      { header: 'Ore ext',  width: 70, align: 'right' },
    ],
    rows,
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="consuntivazione_extra_${IT_MONTHS[month-1].toLowerCase()}_${year}.pdf"`,
    },
  })
}
