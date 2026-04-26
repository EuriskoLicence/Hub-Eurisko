'use server'

import { and, eq, sql, desc, isNull, ne, inArray } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  users, timesheetMonths, expenseReports,
  engagementUsers, engagements, projects, clients,
  timesheetEntries, expenseLines,
  roles, roleProfiles, profileSections,
} from '@/db/schema'
import { requireSection, HttpError } from '@/lib/permissions/auth-helpers'
import { reviewTimesheetAmendment } from '@/app/(dashboard)/timesheet/[year]/[month]/actions'
import { reviewExpenseAmendment } from '@/app/(dashboard)/expenses/detail-actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserMonthRow = {
  userId:          string
  fullName:        string
  email:           string
  year:            number
  month:           number
  timesheetStatus: string | null  // null = no record
  totalHours:      number
  expenseStatus:   string | null
  totalExpenses:   string
}

/** Riga per la dashboard note spese (filtrata per data invio) */
export type ExpenseSubmissionRow = {
  reportId:     string
  userId:       string
  fullName:     string
  email:        string
  /** Mese di competenza della nota spese */
  compYear:     number
  compMonth:    number
  /** Data invio (approvedAt) */
  submittedAt:  string
  status:       string
  totalAmount:  string
}

export type AmendmentRow = {
  type:       'timesheet' | 'expense'
  id:         string
  userId:     string
  fullName:   string
  email:      string
  year:       number
  month:      number
  title:      string | null   // expense report title
  reason:     string
  requestedAt: string
  status:     string
}

export type ExportRow = {
  fullName:        string
  email:           string
  year:            number
  month:           number
  timesheetStatus: string
  totalHours:      number
  expenseStatus:   string
  totalExpenses:   string
}

// ─── Helper: utenti attivi con una specifica sezione ─────────────────────────

async function getUsersWithSection(sectionCode: string) {
  // users → roles → role_profiles → profiles → profile_sections
  // Esclude utenti con exclude_from_timesheet = true
  const rows = await db
    .selectDistinct({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(users)
    .innerJoin(roles,          eq(roles.id,           users.roleId))
    .innerJoin(roleProfiles,   eq(roleProfiles.roleId, roles.id))
    .innerJoin(profileSections, and(
      eq(profileSections.profileId,   roleProfiles.profileId),
      eq(profileSections.sectionCode, sectionCode),
    ))
    .where(and(
      eq(users.active, true),
      eq(users.excludeFromTimesheet, false),
    ))
    .orderBy(users.lastName, users.firstName)
  return rows
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getFinanceDashboard(year: number, month: number): Promise<UserMonthRow[]> {
  const session = await auth()
  requireSection(session, 'FINANCE_DASHBOARD')

  // Solo utenti con sezione TIMESHEET (per consuntivazione) attiva nel proprio ruolo
  const allUsers = await getUsersWithSection('TIMESHEET')

  // Timesheet months for this period
  const tsMonths = await db
    .select({
      userId:      timesheetMonths.userId,
      status:      timesheetMonths.status,
      totalHours:  sql<number>`coalesce(sum(${timesheetEntries.hours}), 0)`,
    })
    .from(timesheetMonths)
    .leftJoin(
      timesheetEntries,
      and(
        eq(timesheetEntries.userId, timesheetMonths.userId),
        eq(timesheetEntries.year,   timesheetMonths.year),
        eq(timesheetEntries.month,  timesheetMonths.month),
      ),
    )
    .where(and(eq(timesheetMonths.year, year), eq(timesheetMonths.month, month)))
    .groupBy(timesheetMonths.userId, timesheetMonths.status)

  // Expense reports for this period (take latest status per user if multiple)
  const expReports = await db
    .select({
      userId:      expenseReports.userId,
      status:      expenseReports.status,
      totalAmount: expenseReports.totalAmount,
    })
    .from(expenseReports)
    .where(and(eq(expenseReports.year, year), eq(expenseReports.month, month)))

  // Build lookup maps
  const tsMap  = new Map(tsMonths.map((r) => [r.userId, r]))
  const expMap = new Map<string, { status: string; totalAmount: string }>()
  for (const r of expReports) {
    const existing = expMap.get(r.userId)
    // Sum amounts per user (multiple reports possible)
    if (existing) {
      expMap.set(r.userId, {
        status:      r.status, // last one wins for status
        totalAmount: (parseFloat(existing.totalAmount) + parseFloat(r.totalAmount)).toFixed(2),
      })
    } else {
      expMap.set(r.userId, { status: r.status, totalAmount: r.totalAmount })
    }
  }

  return allUsers.map((u) => {
    const ts  = tsMap.get(u.id)
    const exp = expMap.get(u.id)
    return {
      userId:          u.id,
      fullName:        `${u.lastName} ${u.firstName}`,
      email:           u.email,
      year,
      month,
      timesheetStatus: ts?.status ?? null,
      totalHours:      ts ? Number(ts.totalHours) : 0,
      expenseStatus:   exp?.status ?? null,
      totalExpenses:   exp?.totalAmount ?? '0.00',
    }
  })
}

// ─── Contatore rettifiche pending ─────────────────────────────────────────────

export async function getPendingAmendmentCount(): Promise<number> {
  const session = await auth()
  requireSection(session, 'FINANCE_AMENDMENT')

  const [tsCount] = await db
    .select({ n: sql<number>`cast(count(*) as int)` })
    .from(timesheetMonths)
    .where(eq(timesheetMonths.status, 'amendment_requested'))

  const [expCount] = await db
    .select({ n: sql<number>`cast(count(*) as int)` })
    .from(expenseReports)
    .where(eq(expenseReports.status, 'amendment_requested'))

  return Number(tsCount.n) + Number(expCount.n)
}

// ─── Lista rettifiche ─────────────────────────────────────────────────────────

export async function getAmendmentList(): Promise<AmendmentRow[]> {
  const session = await auth()
  requireSection(session, 'FINANCE_AMENDMENT')

  // Timesheet amendments
  const tsRows = await db
    .select({
      id:          timesheetMonths.id,
      userId:      timesheetMonths.userId,
      firstName:   users.firstName,
      lastName:    users.lastName,
      email:       users.email,
      year:        timesheetMonths.year,
      month:       timesheetMonths.month,
      reason:      timesheetMonths.amendmentReason,
      requestedAt: timesheetMonths.amendmentRequestedAt,
      status:      timesheetMonths.status,
    })
    .from(timesheetMonths)
    .innerJoin(users, eq(users.id, timesheetMonths.userId))
    .where(eq(timesheetMonths.status, 'amendment_requested'))
    .orderBy(desc(timesheetMonths.amendmentRequestedAt))

  // Expense amendments
  const expRows = await db
    .select({
      id:          expenseReports.id,
      userId:      expenseReports.userId,
      firstName:   users.firstName,
      lastName:    users.lastName,
      email:       users.email,
      year:        expenseReports.year,
      month:       expenseReports.month,
      title:       expenseReports.title,
      reason:      expenseReports.amendmentReason,
      requestedAt: expenseReports.amendmentRequestedAt,
      status:      expenseReports.status,
    })
    .from(expenseReports)
    .innerJoin(users, eq(users.id, expenseReports.userId))
    .where(eq(expenseReports.status, 'amendment_requested'))
    .orderBy(desc(expenseReports.amendmentRequestedAt))

  const result: AmendmentRow[] = [
    ...tsRows.map((r) => ({
      type:        'timesheet' as const,
      id:          r.id,
      userId:      r.userId,
      fullName:    `${r.lastName} ${r.firstName}`,
      email:       r.email,
      year:        r.year,
      month:       r.month,
      title:       null,
      reason:      r.reason ?? '',
      requestedAt: r.requestedAt?.toISOString() ?? '',
      status:      r.status,
    })),
    ...expRows.map((r) => ({
      type:        'expense' as const,
      id:          r.id,
      userId:      r.userId,
      fullName:    `${r.lastName} ${r.firstName}`,
      email:       r.email,
      year:        r.year,
      month:       r.month,
      title:       r.title,
      reason:      r.reason ?? '',
      requestedAt: r.requestedAt?.toISOString() ?? '',
      status:      r.status,
    })),
  ]

  // Sort all by requestedAt desc
  return result.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
}

// ─── Approva / Rifiuta rettifica ─────────────────────────────────────────────

export { reviewTimesheetAmendment, reviewExpenseAmendment }

// ─── Export CSV ───────────────────────────────────────────────────────────────

export async function getExportData(year: number, month: number): Promise<ExportRow[]> {
  const session = await auth()
  requireSection(session, 'FINANCE_EXPORT')

  const rows = await getFinanceDashboard(year, month)
  return rows.map((r) => ({
    fullName:        r.fullName,
    email:           r.email,
    year:            r.year,
    month:           r.month,
    timesheetStatus: r.timesheetStatus ?? 'non_compilato',
    totalHours:      r.totalHours,
    expenseStatus:   r.expenseStatus ?? 'nessuna',
    totalExpenses:   r.totalExpenses,
  }))
}

// ─── Dashboard Note Spese (filtro per data invio) ────────────────────────────

export async function getExpenseDashboard(year: number, month: number): Promise<ExpenseSubmissionRow[]> {
  const session = await auth()
  requireSection(session, 'FINANCE_DASHBOARD')

  const rows = await db
    .select({
      id:          expenseReports.id,
      userId:      expenseReports.userId,
      firstName:   users.firstName,
      lastName:    users.lastName,
      email:       users.email,
      compYear:    expenseReports.year,
      compMonth:   expenseReports.month,
      status:      expenseReports.status,
      totalAmount: expenseReports.totalAmount,
      approvedAt:  expenseReports.approvedAt,
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

  return rows.map((r) => ({
    reportId:    r.id,
    userId:      r.userId,
    fullName:    `${r.lastName} ${r.firstName}`,
    email:       r.email,
    compYear:    r.compYear,
    compMonth:   r.compMonth,
    submittedAt: r.approvedAt?.toISOString() ?? '',
    status:      r.status,
    totalAmount: r.totalAmount,
  }))
}

// ─── Sollecito: utenti senza consuntivazione inviata ─────────────────────────

export async function getUsersWithoutSubmittedTimesheet(
  year: number,
  month: number,
): Promise<{ userId: string; fullName: string; email: string }[]> {
  const session = await auth()
  requireSection(session, 'FINANCE_DASHBOARD')

  // Solo utenti con sezione TIMESHEET attiva
  const allUsers = await getUsersWithSection('TIMESHEET')

  const submitted = await db
    .select({ userId: timesheetMonths.userId })
    .from(timesheetMonths)
    .where(
      and(
        eq(timesheetMonths.year,   year),
        eq(timesheetMonths.month,  month),
        ne(timesheetMonths.status, 'draft'),
      ),
    )

  const submittedIds = new Set(submitted.map((r) => r.userId))

  return allUsers
    .filter((u) => !submittedIds.has(u.id))
    .map((u) => ({ userId: u.id, fullName: `${u.lastName} ${u.firstName}`, email: u.email }))
}
