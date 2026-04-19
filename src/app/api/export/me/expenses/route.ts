import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx-js-style'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { requireSection } from '@/lib/permissions/auth-helpers'
import { db } from '@/db'
import { expenseReports, expenseLines, expenseCategories, engagements, projects, clients } from '@/db/schema'

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

  // Trova il report del mese
  const reportRows = await db
    .select({ id: expenseReports.id })
    .from(expenseReports)
    .where(and(
      eq(expenseReports.userId, userId),
      eq(expenseReports.year,   year),
      eq(expenseReports.month,  month),
    ))
    .limit(1)

  const periodoLabel = `${IT_MONTHS[month - 1]} ${year}`

  if (!reportRows.length) {
    // Nessun report: restituisce Excel vuoto
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([['Nessuna nota spese per il periodo selezionato.']])
    XLSX.utils.book_append_sheet(wb, ws, 'Note spese')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="note_spese_${IT_MONTHS[month-1].toLowerCase()}_${year}.xlsx"`,
      },
    })
  }

  const lines = await db
    .select({
      date:          expenseLines.date,
      categoryLabel: expenseCategories.label,
      engagementName: engagements.name,
      projectName:   projects.name,
      clientName:    clients.name,
      description:   expenseLines.description,
      amountEur:     expenseLines.amountEur,
    })
    .from(expenseLines)
    .innerJoin(expenseCategories, eq(expenseLines.categoryId,    expenseCategories.id))
    .leftJoin(engagements,        eq(expenseLines.engagementId,  engagements.id))
    .leftJoin(projects,           eq(engagements.projectId,      projects.id))
    .leftJoin(clients,            eq(projects.clientId,          clients.id))
    .where(eq(expenseLines.reportId, reportRows[0].id))
    .orderBy(expenseLines.date)

  const headers = ['Periodo', 'Data', 'Categoria', 'Commessa', 'Descrizione', 'Importo EUR']

  const dataRows = lines.map((l) => {
    const d    = new Date(l.date)
    const dd   = String(d.getUTCDate()).padStart(2, '0')
    const mm   = String(d.getUTCMonth() + 1).padStart(2, '0')
    const yyyy = d.getUTCFullYear()
    const comm = l.engagementName
      ? `${l.clientName} — ${l.projectName} — ${l.engagementName}`
      : ''
    return [periodoLabel, `${dd}/${mm}/${yyyy}`, l.categoryLabel, comm, l.description, `€ ${parseFloat(l.amountEur).toFixed(2)}`]
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
  ws['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 50 }, { wch: 30 }, { wch: 14 }]

  XLSX.utils.book_append_sheet(wb, ws, 'Note spese')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="note_spese_${IT_MONTHS[month-1].toLowerCase()}_${year}.xlsx"`,
    },
  })
}
