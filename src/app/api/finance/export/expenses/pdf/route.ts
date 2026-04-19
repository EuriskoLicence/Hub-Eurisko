import { NextRequest, NextResponse } from 'next/server'
import { and, eq, ne, sql, inArray } from 'drizzle-orm'
import { auth } from '@/auth'
import { handleAuthError, requireSection } from '@/lib/permissions/auth-helpers'
import { db } from '@/db'
import { users, expenseReports, expenseLines, expenseCategories } from '@/db/schema'
import { generatePdfTable } from '@/lib/pdf-table'

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    requireSection(session, 'FINANCE_EXPORT')

    const { searchParams } = req.nextUrl
    const year  = parseInt(searchParams.get('year')  ?? '')
    const month = parseInt(searchParams.get('month') ?? '')

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Parametri non validi.' }, { status: 400 })
    }

    const filterPeriodLabel = `${IT_MONTHS[month - 1]} ${year}`

    const reports = await db
      .select({
        reportId:   expenseReports.id,
        userId:     expenseReports.userId,
        firstName:  users.firstName,
        lastName:   users.lastName,
        compYear:   expenseReports.year,
        compMonth:  expenseReports.month,
        approvedAt: expenseReports.approvedAt,
      })
      .from(expenseReports)
      .innerJoin(users, eq(users.id, expenseReports.userId))
      .where(and(
        ne(expenseReports.status, 'draft'),
        sql`EXTRACT(YEAR  FROM ${expenseReports.approvedAt}) = ${year}`,
        sql`EXTRACT(MONTH FROM ${expenseReports.approvedAt}) = ${month}`,
      ))
      .orderBy(users.lastName, users.firstName)

    const wsRows: (string | number)[][] = []

    if (reports.length > 0) {
      const reportIds = reports.map((r) => r.reportId)
      const lines = await db
        .select({ reportId: expenseLines.reportId, categoryLabel: expenseCategories.label, amountEur: expenseLines.amountEur })
        .from(expenseLines)
        .innerJoin(expenseCategories, eq(expenseLines.categoryId, expenseCategories.id))
        .where(inArray(expenseLines.reportId, reportIds))

      const aggKey = (rid: string, cat: string) => `${rid}||${cat}`
      const aggMap = new Map<string, number>()
      const catOrder = new Map<string, number>()
      for (const l of lines) {
        const k = aggKey(l.reportId, l.categoryLabel)
        aggMap.set(k, (aggMap.get(k) ?? 0) + parseFloat(l.amountEur))
        if (!catOrder.has(l.categoryLabel)) catOrder.set(l.categoryLabel, catOrder.size)
      }

      for (const r of reports) {
        const fullName  = `${r.lastName} ${r.firstName}`
        const compLabel = `${IT_MONTHS[r.compMonth - 1]} ${r.compYear}`
        const sentDate  = r.approvedAt ? new Date(r.approvedAt).toLocaleDateString('it-IT') : ''

        const cats = Array.from(catOrder.entries())
          .filter(([cat]) => aggMap.has(aggKey(r.reportId, cat)))
          .sort((a, b) => a[1] - b[1])
          .map(([cat]) => cat)

        for (const cat of cats) {
          const amount = aggMap.get(aggKey(r.reportId, cat)) ?? 0
          wsRows.push([filterPeriodLabel, fullName, compLabel, sentDate, cat, `€ ${amount.toFixed(2)}`])
        }
      }
    }

    const buffer = await generatePdfTable({
      title:   `Note spese — ${filterPeriodLabel}`,
      columns: [
        { header: 'Periodo invio',   width: 80  },
        { header: 'Cognome e Nome',  width: 130 },
        { header: 'Mese competenza', width: 90  },
        { header: 'Data invio',      width: 70  },
        { header: 'Voce spesa',      width: 130 },
        { header: 'Importo EUR',     width: 70, align: 'right' },
      ],
      rows: wsRows,
    })

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="note_spese_${IT_MONTHS[month - 1]}_${year}.pdf"`,
      },
    })
  } catch (err) {
    return handleAuthError(err)
  }
}
