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

    const headers = [
      'Periodo invio',
      'Cognome e Nome',
      'Rimborsi km',
      'Altro',
      'Totale',
      'Tariffa km',
    ]

    // Report inviati nel periodo selezionato (filtro su approved_at)
    const reports = await db
      .select({
        reportId:  expenseReports.id,
        firstName: users.firstName,
        lastName:  users.lastName,
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

    const filterPeriodLabel = `${IT_MONTHS[month - 1]} ${year}`

    const wsRows: (string | number)[][] = []

    if (reports.length > 0) {
      const reportIds = reports.map((r) => r.reportId)

      // Righe di spesa con flag isKmBased e tariffaKm
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

      // Aggrega per report
      type ReportAgg = { kmTotal: number; total: number; tariffaKm: string | null }
      const aggMap = new Map<string, ReportAgg>()
      for (const l of lines) {
        const agg = aggMap.get(l.reportId) ?? { kmTotal: 0, total: 0, tariffaKm: null }
        const eur = parseFloat(l.amountEur)
        agg.total += eur
        if (l.isKmBased) {
          agg.kmTotal += eur
          if (!agg.tariffaKm && l.tariffaKm) agg.tariffaKm = l.tariffaKm
        }
        aggMap.set(l.reportId, agg)
      }

      for (const r of reports) {
        const fullName = `${r.lastName} ${r.firstName}`

        const agg      = aggMap.get(r.reportId) ?? { kmTotal: 0, total: 0, tariffaKm: null }
        const kmTotal  = parseFloat(agg.kmTotal.toFixed(2))
        const total    = parseFloat(agg.total.toFixed(2))
        const altro    = parseFloat((total - kmTotal).toFixed(2))
        const tariffa  = agg.tariffaKm ? parseFloat(agg.tariffaKm).toFixed(4) : ''

        wsRows.push([
          filterPeriodLabel,
          fullName,
          kmTotal,
          altro,
          total,
          tariffa,
        ])
      }
    }

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
      { wch: 14 }, // Rimborsi km
      { wch: 14 }, // Altro
      { wch: 14 }, // Totale
      { wch: 12 }, // Tariffa km
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
