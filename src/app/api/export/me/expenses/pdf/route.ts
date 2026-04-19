import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { requireSection } from '@/lib/permissions/auth-helpers'
import { db } from '@/db'
import { expenseReports, expenseLines, expenseCategories, engagements, projects, clients, users } from '@/db/schema'
import { generatePdfTable } from '@/lib/pdf-table'

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

export async function GET(req: NextRequest) {
  const session = await auth()
  requireSection(session, 'EXPENSES')
  const userId = session.user.id

  const { searchParams } = req.nextUrl
  const year  = parseInt(searchParams.get('year')  ?? '')
  const month = parseInt(searchParams.get('month') ?? '')
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Parametri non validi.' }, { status: 400 })
  }

  const [reportRows, userRows] = await Promise.all([
    db.select({ id: expenseReports.id })
      .from(expenseReports)
      .where(and(
        eq(expenseReports.userId, userId),
        eq(expenseReports.year,   year),
        eq(expenseReports.month,  month),
      ))
      .limit(1),
    db.select({ firstName: users.firstName, lastName: users.lastName })
      .from(users).where(eq(users.id, userId)).limit(1),
  ])

  const userName     = userRows[0] ? `${userRows[0].firstName} ${userRows[0].lastName}` : ''
  const periodoLabel = `${IT_MONTHS[month - 1]} ${year}`

  if (!reportRows.length) {
    const buffer = await generatePdfTable({
      title:   `Note spese — ${userName} — ${periodoLabel}`,
      columns: [{ header: 'Nota', width: 545 }],
      rows:    [['Nessuna nota spese per il periodo selezionato.']],
    })
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="note_spese_${IT_MONTHS[month-1].toLowerCase()}_${year}.pdf"`,
      },
    })
  }

  const lines = await db
    .select({
      date:           expenseLines.date,
      categoryLabel:  expenseCategories.label,
      engagementName: engagements.name,
      projectName:    projects.name,
      clientName:     clients.name,
      description:    expenseLines.description,
      amountEur:      expenseLines.amountEur,
    })
    .from(expenseLines)
    .innerJoin(expenseCategories, eq(expenseLines.categoryId,   expenseCategories.id))
    .leftJoin(engagements,        eq(expenseLines.engagementId, engagements.id))
    .leftJoin(projects,           eq(engagements.projectId,     projects.id))
    .leftJoin(clients,            eq(projects.clientId,         clients.id))
    .where(eq(expenseLines.reportId, reportRows[0].id))
    .orderBy(expenseLines.date)

  const rows = lines.map((l) => {
    const d    = new Date(l.date)
    const dd   = String(d.getUTCDate()).padStart(2, '0')
    const mm   = String(d.getUTCMonth() + 1).padStart(2, '0')
    const yyyy = d.getUTCFullYear()
    const comm = l.engagementName
      ? `${l.clientName} — ${l.projectName} — ${l.engagementName}`
      : ''
    return [periodoLabel, `${dd}/${mm}/${yyyy}`, l.categoryLabel, comm, l.description, `€ ${parseFloat(l.amountEur).toFixed(2)}`]
  })

  const buffer = await generatePdfTable({
    title:   `Note spese — ${userName} — ${periodoLabel}`,
    columns: [
      { header: 'Periodo',     width: 80  },
      { header: 'Data',        width: 55  },
      { header: 'Categoria',   width: 90  },
      { header: 'Commessa',    width: 180 },
      { header: 'Descrizione', width: 120 },
      { header: 'Importo',     width: 70, align: 'right' },
    ],
    rows,
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="note_spese_${IT_MONTHS[month-1].toLowerCase()}_${year}.pdf"`,
    },
  })
}
