'use server'

import { and, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  expenseReports, expenseLines, expenseCategories,
  engagementUsers, engagements, projects, clients,
  users,
} from '@/db/schema'
import { requireSection } from '@/lib/permissions/auth-helpers'
import { getMonthCalendar } from '@/lib/italian-calendar'
import type {
  ExpensePageData, ExpenseReportData, ExpenseRowState,
} from '@/types/expenses'
import type { CalendarDaySerialized } from '@/types/timesheet'

const IT_DAY_ABBR = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']

function isFutureMonth(year: number, month: number): boolean {
  const now = new Date()
  return year > now.getFullYear() ||
    (year === now.getFullYear() && month > now.getMonth() + 1)
}

export type FinanceExpenseViewData = ExpensePageData & {
  targetUserName: string
}

export async function getFinanceExpenseView(
  targetUserId: string,
  year:         number,
  month:        number,
): Promise<FinanceExpenseViewData> {
  const session = await auth()
  requireSection(session, 'FINANCE_DASHBOARD')

  // Nome utente target e tariffa km
  const userRows = await db
    .select({ firstName: users.firstName, lastName: users.lastName, tariffaKm: users.tariffaKm })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1)

  const targetUserName = userRows[0]
    ? `${userRows[0].firstName} ${userRows[0].lastName}`
    : 'Utente'
  const userTariffaKm = userRows[0]?.tariffaKm ?? null

  // Report esistente
  const reportRows = await db
    .select()
    .from(expenseReports)
    .where(and(
      eq(expenseReports.userId, targetUserId),
      eq(expenseReports.year,   year),
      eq(expenseReports.month,  month),
    ))
    .limit(1)

  const r = reportRows[0] ?? null

  // Categorie attive
  const catRows = await db
    .select()
    .from(expenseCategories)
    .where(eq(expenseCategories.active, true))

  // Commesse dell'utente target
  const engRows = await db
    .select({
      id:          engagements.id,
      name:        engagements.name,
      code:        engagements.code,
      projectName: projects.name,
      clientName:  clients.name,
    })
    .from(engagementUsers)
    .innerJoin(engagements, eq(engagementUsers.engagementId, engagements.id))
    .innerJoin(projects,    eq(engagements.projectId,        projects.id))
    .innerJoin(clients,     eq(projects.clientId,            clients.id))
    .where(
      and(
        eq(engagementUsers.userId, targetUserId),
        eq(engagements.active,     true),
        eq(projects.active,        true),
        eq(clients.active,         true),
      ),
    )

  // Calendario
  const calDays = await getMonthCalendar(year, month)
  const calendar: CalendarDaySerialized[] = calDays.map((d) => ({
    isoDate:      d.isoDate,
    dayOfMonth:   d.date.getUTCDate(),
    dayOfWeek:    d.dayOfWeek,
    dayAbbr:      IT_DAY_ABBR[d.dayOfWeek],
    isWeekend:    d.isWeekend,
    isHoliday:    d.isHoliday,
    holidayName:  d.holidayName,
    isWorkingDay: d.isWorkingDay,
  }))

  // Righe griglia (solo se esiste il report)
  let savedKmRate: string | null = null
  const rowMap = new Map<string, ExpenseRowState>()
  if (r) {
    const lineRows = await db
      .select({
        id:                 expenseLines.id,
        categoryId:         expenseLines.categoryId,
        engagementId:       expenseLines.engagementId,
        date:               expenseLines.date,
        description:        expenseLines.description,
        amount:             expenseLines.amount,
        currency:           expenseLines.currency,
        exchangeRate:       expenseLines.exchangeRate,
        amountEur:          expenseLines.amountEur,
        kmDistance:         expenseLines.kmDistance,
        tariffaKm:          expenseLines.tariffaKm,
        attachmentKey:      expenseLines.attachmentKey,
        attachmentFilename: expenseLines.attachmentFilename,
        catCode:            expenseCategories.code,
        catLabel:           expenseCategories.label,
        catRequires:        expenseCategories.requiresAttachment,
        catKmBased:         expenseCategories.isKmBased,
      })
      .from(expenseLines)
      .innerJoin(expenseCategories, eq(expenseLines.categoryId, expenseCategories.id))
      .where(eq(expenseLines.reportId, r.id))

    savedKmRate = lineRows.find((l) => l.tariffaKm)?.tariffaKm ?? null
    const effectiveKmRate = savedKmRate ?? userTariffaKm

    for (const line of lineRows) {
      const rowKey = `${line.categoryId}|${line.engagementId ?? ''}`
      if (!rowMap.has(rowKey)) {
        const eng = engRows.find((e) => e.id === line.engagementId)
        rowMap.set(rowKey, {
          localId:            rowKey,
          categoryId:         line.categoryId,
          categoryLabel:      line.catLabel,
          categoryCode:       line.catCode,
          requiresAttachment: line.catRequires,
          isKmBased:          line.catKmBased,
          engagementId:       line.engagementId  ?? null,
          engagementName:     eng ? `${eng.name} (${eng.code})` : null,
          kmRate:             line.catKmBased ? effectiveKmRate : null,
          cells:              {},
        })
      }
      const row = rowMap.get(rowKey)!
      const day = parseInt(line.date.split('-')[2])
      row.cells[day] = {
        lineId:             line.id,
        amount:             line.amount,
        currency:           line.currency,
        exchangeRate:       line.exchangeRate,
        amountEur:          line.amountEur,
        kmDistance:         line.kmDistance  ?? '',
        description:        line.description,
        attachmentKey:      line.attachmentKey      ?? null,
        attachmentFilename: line.attachmentFilename ?? null,
      }
    }
  }

  const report: ExpenseReportData | null = r ? {
    id:                       r.id,
    year:                     r.year,
    month:                    r.month,
    title:                    r.title,
    totalAmount:              r.totalAmount,
    currency:                 r.currency,
    status:                   r.status as any,
    approvedAt:               r.approvedAt?.toISOString()            ?? null,
    amendmentRequestedAt:     r.amendmentRequestedAt?.toISOString()  ?? null,
    amendmentReason:          r.amendmentReason                      ?? null,
    amendmentRejectionReason: r.amendmentRejectionReason             ?? null,
    amendmentReviewedBy:      r.amendmentReviewedBy                  ?? null,
  } : null

  return {
    report,
    year,
    month,
    isFuture:     isFutureMonth(year, month),
    rows:         Array.from(rowMap.values()),
    categories:   catRows.map((c) => ({
      id: c.id, code: c.code, label: c.label,
      requiresAttachment: c.requiresAttachment,
      isKmBased: c.isKmBased,
    })),
    engagements:  engRows,
    userTariffaKm: savedKmRate ?? userTariffaKm,
    calendar,
    targetUserName,
  }
}
