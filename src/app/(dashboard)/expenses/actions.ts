'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { and, eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { auth } from '@/auth'
import { db } from '@/db'
import { expenseReports } from '@/db/schema'
import { requireSection, HttpError } from '@/lib/permissions/auth-helpers'
import type { ExpenseReportSummary } from '@/types/expenses'

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

// ─── Lista note spese dell'utente ─────────────────────────────────────────────

export async function getExpenseReportList(): Promise<ExpenseReportSummary[]> {
  const session = await auth()
  requireSection(session, 'EXPENSES')
  const userId = session.user.id

  const rows = await db
    .select()
    .from(expenseReports)
    .where(eq(expenseReports.userId, userId))
    .orderBy(desc(expenseReports.year), desc(expenseReports.month))

  return rows.map((r) => ({
    id:          r.id,
    year:        r.year,
    month:       r.month,
    monthLabel:  `${IT_MONTHS[r.month - 1]} ${r.year}`,
    title:       r.title,
    totalAmount: r.totalAmount,
    currency:    r.currency,
    status:      r.status as any,
  }))
}

// ─── Dati anno per griglia mensile ────────────────────────────────────────────

export type ExpenseMonthCard = {
  year:      number
  month:     number
  monthLabel: string
  reports:   { id: string; title: string; status: string; totalAmount: string }[]
  isFuture:  boolean
  isCurrent: boolean
}

export async function getExpenseYearData(year: number): Promise<{
  months: ExpenseMonthCard[]
  summary: { submitted: number; draft: number; notOpened: number }
  currentYear: number
}> {
  const session = await auth()
  requireSection(session, 'EXPENSES')
  const userId = session.user.id

  const now      = new Date()
  const curYear  = now.getFullYear()
  const curMonth = now.getMonth() + 1

  const rows = await db
    .select()
    .from(expenseReports)
    .where(and(eq(expenseReports.userId, userId), eq(expenseReports.year, year)))
    .orderBy(desc(expenseReports.month))

  const months: ExpenseMonthCard[] = Array.from({ length: 12 }, (_, i) => {
    const month     = i + 1
    const isFuture  = year > curYear || (year === curYear && month > curMonth)
    const monthRows = rows.filter((r) => r.month === month)
    return {
      year,
      month,
      monthLabel: IT_MONTHS[month - 1],
      reports:    monthRows.map((r) => ({
        id:          r.id,
        title:       r.title,
        status:      r.status,
        totalAmount: r.totalAmount,
      })),
      isFuture,
      isCurrent: year === curYear && month === curMonth,
    }
  })

  // Calcola riepilogi contando i mesi, non i report
  const submitted = months.filter((m) => m.reports.some((r) => r.status === 'submitted' || r.status === 'approved')).length
  const draft     = months.filter((m) => m.reports.some((r) => r.status === 'draft')).length
  const notOpened = months.filter((m) => m.reports.length === 0).length

  return { months, summary: { submitted, draft, notOpened }, currentYear: curYear }
}

// ─── Creazione nuova nota spese ───────────────────────────────────────────────

const createSchema = z.object({
  year:  z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  title: z.string().min(1, 'Il titolo è obbligatorio').max(200),
})

export async function createExpenseReport(
  data: { year: number; month: number; title: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'EXPENSES')
    const userId = session.user.id

    const parsed = createSchema.safeParse(data)
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message }

    const { year, month, title } = parsed.data

    const inserted = await db
      .insert(expenseReports)
      .values({ userId, year, month, title, totalAmount: '0', currency: 'EUR', status: 'draft' })
      .returning({ id: expenseReports.id })

    revalidatePath('/expenses')
    return { ok: true, id: inserted[0].id }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('createExpenseReport error:', err)
    return { ok: false, error: 'Errore del server. Riprova.' }
  }
}

