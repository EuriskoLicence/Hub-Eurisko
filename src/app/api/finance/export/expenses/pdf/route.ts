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
        reportId:  expenseReports.id,
        userId:    expenseReports.userId,
        firstName: users.firstName,
        lastName:  users.lastName,
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

      const reportMeta = new Map(reports.map((r) => [
        r.reportId,
        { userId: r.userId, firstName: r.firstName, lastName: r.lastName },
      ]))

      const lines = await db
        .select({
          reportId:  expenseLines.reportId,
          amountEur: expenseLines.amountEur,
          isKmBased: expenseCategories.isKmBased,
          tariffaKm: expenseLines.tariffaKm,
        })
        .from(expenseLines)
        .innerJoin(expenseCategories, eq(expenseLines.categoryId, expenseCategories.id))
        .where(inArray(expenseLines.reportId, reportIds))

      // 1ª passata: determina tariffaKm per ogni report
      const reportKmRate = new Map<string, string | null>()
      for (const l of lines) {
        if (l.isKmBased && l.tariffaKm && !reportKmRate.has(l.reportId)) {
          reportKmRate.set(l.reportId, l.tariffaKm)
        }
      }

      // 2ª passata: aggrega per (userId, tariffaKm)
      type UserAgg = { firstName: string; lastName: string; kmTotal: number; total: number; tariffaKm: string | null }
      const userAggMap = new Map<string, UserAgg>()

      for (const l of lines) {
        const meta   = reportMeta.get(l.reportId)!
        const kmRate = reportKmRate.get(l.reportId) ?? null
        const key    = `${meta.userId}|${kmRate ?? ''}`
        const agg    = userAggMap.get(key) ?? {
          firstName: meta.firstName,
          lastName:  meta.lastName,
          kmTotal:   0,
          total:     0,
          tariffaKm: kmRate,
        }
        const eur = parseFloat(l.amountEur)
        agg.total += eur
        if (l.isKmBased) agg.kmTotal += eur
        userAggMap.set(key, agg)
      }

      const sorted = Array.from(userAggMap.values())
        .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))

      for (const agg of sorted) {
        const fullName = `${agg.lastName} ${agg.firstName}`
        const kmTotal  = parseFloat(agg.kmTotal.toFixed(2))
        const total    = parseFloat(agg.total.toFixed(2))
        const altro    = parseFloat((total - kmTotal).toFixed(2))
        const tariffa  = agg.tariffaKm ? `€ ${parseFloat(agg.tariffaKm).toFixed(4)}` : '—'

        wsRows.push([
          filterPeriodLabel,
          fullName,
          kmTotal > 0 ? `€ ${kmTotal.toFixed(2)}` : '—',
          altro   > 0 ? `€ ${altro.toFixed(2)}`   : '—',
          `€ ${total.toFixed(2)}`,
          tariffa,
        ])
      }
    }

    const buffer = await generatePdfTable({
      title:   `Note spese — ${filterPeriodLabel}`,
      columns: [
        { header: 'Periodo invio',  width: 80  },
        { header: 'Cognome e Nome', width: 160 },
        { header: 'Rimborsi km',    width: 70, align: 'right' },
        { header: 'Altro',          width: 70, align: 'right' },
        { header: 'Totale',         width: 70, align: 'right' },
        { header: 'Tariffa km',     width: 65, align: 'right' },
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
