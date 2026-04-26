'use server'

import { and, eq, gte, sql } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  timesheetEntries,
  timesheetMonths,
  engagementUsers,
  engagements,
  projects,
  clients,
  absenceTypes,
  users,
} from '@/db/schema'
import { requireSection } from '@/lib/permissions/auth-helpers'
import { getMonthCalendar } from '@/lib/italian-calendar'
import type {
  TimesheetPageData,
  CalendarDaySerialized,
  MonthStatusRecord,
} from '@/types/timesheet'

const IT_DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

function isFutureMonth(year: number, month: number): boolean {
  const now = new Date()
  return year > now.getFullYear() ||
    (year === now.getFullYear() && month > now.getMonth() + 1)
}

export type FinanceTimesheetViewData = TimesheetPageData & {
  targetUserName: string
}

export async function getFinanceTimesheetView(
  targetUserId: string,
  year:         number,
  month:        number,
): Promise<FinanceTimesheetViewData> {
  const session = await auth()
  requireSection(session, 'FINANCE_DASHBOARD')

  // Nome utente target
  const userRows = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1)

  const targetUserName = userRows[0]
    ? `${userRows[0].firstName} ${userRows[0].lastName}`
    : 'Utente'

  // Stato mese
  const monthRows = await db
    .select()
    .from(timesheetMonths)
    .where(
      and(
        eq(timesheetMonths.userId, targetUserId),
        eq(timesheetMonths.year,   year),
        eq(timesheetMonths.month,  month),
      ),
    )
    .limit(1)

  const monthStatus: MonthStatusRecord | null = monthRows[0]
    ? {
        id:                       monthRows[0].id,
        status:                   monthRows[0].status as any,
        approvedAt:               monthRows[0].approvedAt?.toISOString() ?? null,
        amendmentRequestedAt:     monthRows[0].amendmentRequestedAt?.toISOString() ?? null,
        amendmentReason:          monthRows[0].amendmentReason ?? null,
        amendmentReviewedBy:      monthRows[0].amendmentReviewedBy ?? null,
        amendmentReviewedAt:      monthRows[0].amendmentReviewedAt?.toISOString() ?? null,
        amendmentRejectionReason: monthRows[0].amendmentRejectionReason ?? null,
      }
    : null

  // Entries del mese
  const entryRows = await db
    .select()
    .from(timesheetEntries)
    .where(
      and(
        eq(timesheetEntries.userId, targetUserId),
        eq(timesheetEntries.year,   year),
        eq(timesheetEntries.month,  month),
      ),
    )

  const entryRecords = entryRows.map((r) => ({
    id:            r.id,
    day:           r.day,
    engagementId:  r.engagementId  ?? null,
    absenceTypeId: r.absenceTypeId ?? null,
    hours:         r.hours,
    notes:         r.notes ?? null,
  }))

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
        eq(projects.active,        true),
        eq(clients.active,         true),
        gte(engagements.validUntil, sql`CURRENT_DATE`),
      ),
    )

  // Voci assenza attive
  const absRows = await db
    .select()
    .from(absenceTypes)
    .where(eq(absenceTypes.active, true))

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

  return {
    year,
    month,
    isFuture:       isFutureMonth(year, month),
    monthStatus,
    entries:        entryRecords,
    engagements:    engRows,
    absences:       absRows.map((a) => ({ id: a.id, shortCode: a.shortCode, label: a.label })),
    calendar,
    targetUserName,
  }
}
