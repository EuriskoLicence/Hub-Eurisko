import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx-js-style'
import { and, eq, ne, sql, inArray } from 'drizzle-orm'
import { auth } from '@/auth'
import { handleAuthError, requireSection } from '@/lib/permissions/auth-helpers'
import { db } from '@/db'
import {
  users, expenseReports, expenseLines, expenseCategories,
} from '@/db/schema'

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

    // Report inviati nel mese selezionato (filtro su approved_at)
    const reports = await db
      .select({
        reportId:   expenseReports.id,
        userId:     expenseReports.userId,
        firstName:  users.firstName,
        lastName:   users.lastName,
        email:      users.email,
        compYear:   expenseReports.year,
        compMonth:  expenseReports.month,
        status:     expenseReports.status,
        approvedAt: expenseReports.approvedAt,
      })
      .from(expenseReports)
      .innerJoin(users, eq(users.id, expenseReports.userId))
      .where(
        and(
          ne(expenseReports.status, 'draft'),
          sql`EXTRACT(YEAR  FROM ${expenseReports.approvedAt}) = ${year}`,
          sql`EXTRACT(MONTH FROM ${expenseReports.approvedAt}) = ${month}`,
        ),
      )
      .orderBy(users.lastName, users.firstName)

    if (reports.length === 0) {
      // Ritorna un foglio vuoto con solo gli header
      const ws = XLSX.utils.aoa_to_sheet([
        ['Cognome e Nome', 'Email', 'Mese competenza', 'Data invio', 'Voce spesa', 'Importo EUR'],
      ])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Note spese')
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="note_spese_${IT_MONTHS[month - 1]}_${year}.xlsx"`,
        },
      })
    }

    const reportIds = reports.map((r) => r.reportId)
    const reportMap = new Map(reports.map((r) => [r.reportId, r]))

    // Righe di spesa per tutti i report trovati
    const lines = await db
      .select({
        reportId:      expenseLines.reportId,
        categoryLabel: expenseCategories.label,
        amountEur:     expenseLines.amountEur,
      })
      .from(expenseLines)
      .innerJoin(expenseCategories, eq(expenseLines.categoryId, expenseCategories.id))
      .where(inArray(expenseLines.reportId, reportIds))

    // Aggrega: reportId + categoryLabel → somma importo EUR
    const aggKey   = (reportId: string, cat: string) => `${reportId}||${cat}`
    const aggMap   = new Map<string, number>()
    const catOrder = new Map<string, number>()

    for (const line of lines) {
      const key = aggKey(line.reportId, line.categoryLabel)
      aggMap.set(key, (aggMap.get(key) ?? 0) + parseFloat(line.amountEur))
      if (!catOrder.has(line.categoryLabel)) catOrder.set(line.categoryLabel, catOrder.size)
    }

    const filterPeriodLabel = `${IT_MONTHS[month - 1]} ${year}`

    // Costruisci righe: una per ogni combinazione report+categoria con importo > 0
    const wsRows: (string | number)[][] = []

    for (const report of reports) {
      const fullName  = `${report.lastName} ${report.firstName}`
      const compLabel = `${IT_MONTHS[report.compMonth - 1]} ${report.compYear}`
      const sentDate  = report.approvedAt
        ? new Date(report.approvedAt).toLocaleDateString('it-IT')
        : ''

      // Raccoglie le categorie di questo report
      const cats = Array.from(catOrder.entries())
        .filter(([cat]) => aggMap.has(aggKey(report.reportId, cat)))
        .sort((a, b) => a[1] - b[1])
        .map(([cat]) => cat)

      if (cats.length === 0) continue

      for (const cat of cats) {
        const amount = aggMap.get(aggKey(report.reportId, cat)) ?? 0
        wsRows.push([
          filterPeriodLabel,
          fullName,
          compLabel,
          sentDate,
          cat,
          parseFloat(amount.toFixed(2)),
        ])
      }
    }

    const headers = [
      'Periodo invio',
      'Cognome e Nome',
      'Mese competenza',
      'Data invio',
      'Voce spesa',
      'Importo EUR',
    ]

    const ws = XLSX.utils.aoa_to_sheet([headers, ...wsRows])

    const headerStyle = {
      font:      { bold: true, color: { rgb: 'FFFFFF' } },
      fill:      { fgColor: { rgb: '374151' } },
      alignment: { horizontal: 'center' },
    }
    for (let c = 0; c < headers.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: 0, c })
      if (ws[ref]) ws[ref].s = headerStyle
    }

    ws['!cols'] = [
      { wch: 16 }, // Periodo invio
      { wch: 28 }, // Cognome e Nome
      { wch: 18 }, // Mese competenza
      { wch: 14 }, // Data invio
      { wch: 28 }, // Voce spesa
      { wch: 14 }, // Importo EUR
    ]

    const label = `${IT_MONTHS[month - 1]}_${year}`
    const wb    = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Note spese')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="note_spese_${label}.xlsx"`,
      },
    })
  } catch (err) {
    return handleAuthError(err)
  }
}
