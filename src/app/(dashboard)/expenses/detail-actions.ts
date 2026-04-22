'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { ATTACHMENTS_ENABLED } from '@/lib/features'
import {
  expenseReports, expenseLines, expenseCategories,
  engagementUsers, engagements, projects, clients,
  users,
} from '@/db/schema'
import { requireSection, HttpError } from '@/lib/permissions/auth-helpers'
import { getMonthCalendar } from '@/lib/italian-calendar'
import { sendAmendmentRequestedEmail, sendAmendmentReviewedEmail } from '@/lib/email'
import type {
  ExpensePageData, ExpenseReportData, ExpenseRowState,
  CellData, SaveLine,
} from '@/types/expenses'
import type { CalendarDaySerialized } from '@/types/timesheet'

const IT_DAY_ABBR = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']

// ─── Aggiorna tariffa km utente ───────────────────────────────────────────────

export async function updateUserTariffaKm(
  rate: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'EXPENSES')
    const userId = session.user.id

    let value: string | null = null
    if (rate !== null && rate !== '') {
      const parsed = parseFloat(rate)
      if (isNaN(parsed) || parsed < 0) return { ok: false, error: 'Tariffa non valida.' }
      value = parsed.toFixed(4)
    }

    await db.update(users).set({ tariffaKm: value }).where(eq(users.id, userId))
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    return { ok: false, error: 'Errore del server.' }
  }
}

function isFutureMonth(year: number, month: number): boolean {
  const now = new Date()
  return year > now.getFullYear() ||
    (year === now.getFullYear() && month > now.getMonth() + 1)
}

// ─── Carica dati pagina mese (senza auto-creazione) ──────────────────────────

export async function getExpenseForMonth(year: number, month: number): Promise<ExpensePageData> {
  const session = await auth()
  requireSection(session, 'EXPENSES')
  const userId = session.user.id

  // Cerca report esistente (senza crearlo)
  const reportRows = await db
    .select()
    .from(expenseReports)
    .where(and(
      eq(expenseReports.userId, userId),
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

  // Commesse abilitate per l'utente
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
        eq(engagementUsers.userId, userId),
        eq(engagements.active,     true),
        eq(projects.active,        true),
        eq(clients.active,         true),
      ),
    )

  // Tariffa km dell'utente
  const userRow = await db
    .select({ tariffaKm: users.tariffaKm })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const userTariffaKm = userRow[0]?.tariffaKm ?? null

  // Calendario
  const calDays = await getMonthCalendar(year, month)
  const calendar: CalendarDaySerialized[] = calDays.map((d) => ({
    isoDate:     d.isoDate,
    dayOfMonth:  d.date.getUTCDate(),
    dayOfWeek:   d.dayOfWeek,
    dayAbbr:     IT_DAY_ABBR[d.dayOfWeek],
    isWeekend:   d.isWeekend,
    isHoliday:   d.isHoliday,
    holidayName: d.holidayName,
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

    // La tariffa km effettiva è quella salvata nella prima riga km-based (se esiste),
    // altrimenti quella del profilo utente
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
  }
}

// ─── Salvataggio righe ────────────────────────────────────────────────────────

const IT_MONTHS_SAVE = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                        'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

export async function saveExpenseLines(
  reportId: string | null,
  year:     number,
  month:    number,
  lines:    SaveLine[],
): Promise<{ ok: true; reportId: string } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'EXPENSES')
    const userId = session.user.id

    if (isFutureMonth(year, month)) {
      return { ok: false, error: 'Non puoi modificare mesi futuri.' }
    }

    let actualReportId = reportId

    if (!actualReportId) {
      // Prima volta che si salva: crea il report
      const inserted = await db
        .insert(expenseReports)
        .values({
          userId,
          year,
          month,
          title:       `${IT_MONTHS_SAVE[month - 1]} ${year}`,
          totalAmount: '0',
          currency:    'EUR',
          status:      'draft',
        })
        .returning({ id: expenseReports.id })
      actualReportId = inserted[0].id
      revalidatePath('/expenses')
    } else {
      // Verifica ownership e stato
      const reportRows = await db
        .select({ status: expenseReports.status })
        .from(expenseReports)
        .where(and(eq(expenseReports.id, actualReportId), eq(expenseReports.userId, userId)))
        .limit(1)

      if (!reportRows.length)                return { ok: false, error: 'Nota spese non trovata.' }
      if (reportRows[0].status !== 'draft')  return { ok: false, error: 'Non puoi modificare questa nota spese.' }
    }

    // Calcola totalAmount
    const totalAmount = lines.reduce((sum, l) => sum + parseFloat(l.amountEur || '0'), 0)

    // Cancella le righe esistenti e reinserisce
    await db.delete(expenseLines).where(eq(expenseLines.reportId, actualReportId))

    if (lines.length > 0) {
      const monthS = String(month).padStart(2, '0')
      await db.insert(expenseLines).values(
        lines.map((l) => ({
          reportId:           actualReportId!,
          categoryId:         l.categoryId,
          engagementId:       l.engagementId  || null,
          date:               `${year}-${monthS}-${String(l.day).padStart(2, '0')}`,
          description:        l.description || '',
          amount:             l.amount,
          currency:           l.currency,
          exchangeRate:       l.exchangeRate,
          amountEur:          l.amountEur,
          kmDistance:         l.kmDistance  || null,
          tariffaKm:          l.tariffaKm   || null,
          attachmentKey:      l.attachmentKey      || null,
          attachmentFilename: l.attachmentFilename || null,
        })),
      )
    }

    await db
      .update(expenseReports)
      .set({ totalAmount: totalAmount.toFixed(2), updatedAt: new Date() })
      .where(eq(expenseReports.id, actualReportId))

    revalidatePath(`/expenses/${year}/${month}`)
    return { ok: true, reportId: actualReportId }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('saveExpenseLines error:', err)
    return { ok: false, error: 'Errore del server. Riprova.' }
  }
}

// ─── Invio definitivo ─────────────────────────────────────────────────────────

export async function submitExpenseReport(
  reportId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'EXPENSES')
    const userId = session.user.id

    const reportRows = await db
      .select()
      .from(expenseReports)
      .where(and(eq(expenseReports.id, reportId), eq(expenseReports.userId, userId)))
      .limit(1)

    if (!reportRows.length)              return { ok: false, error: 'Nota spese non trovata.' }
    if (reportRows[0].status !== 'draft') return { ok: false, error: 'Non puoi inviare questa nota spese.' }
    if (isFutureMonth(reportRows[0].year, reportRows[0].month)) {
      return { ok: false, error: 'Non puoi inviare mesi futuri.' }
    }

    // Verifica che tutte le righe abbiano una commessa
    const allLines = await db
      .select({ engagementId: expenseLines.engagementId })
      .from(expenseLines)
      .where(eq(expenseLines.reportId, reportId))

    const linesMissingEng = allLines.filter((l) => !l.engagementId)
    if (linesMissingEng.length > 0) {
      return { ok: false, error: `${linesMissingEng.length} riga/e senza commessa. Seleziona una commessa per ogni voce di spesa.` }
    }

    // Verifica allegati obbligatori (solo se la funzionalità allegati è abilitata)
    if (ATTACHMENTS_ENABLED) {
      const missingCheck = await db
        .select({ attachmentKey: expenseLines.attachmentKey, description: expenseLines.description })
        .from(expenseLines)
        .innerJoin(expenseCategories, eq(expenseLines.categoryId, expenseCategories.id))
        .where(
          and(
            eq(expenseLines.reportId,              reportId),
            eq(expenseCategories.requiresAttachment, true),
          ),
        )

      const linesWithoutAttachment = missingCheck.filter((l) => !l.attachmentKey)
      if (linesWithoutAttachment.length > 0) {
        return {
          ok: false,
          error: `Allegato mancante per ${linesWithoutAttachment.length} riga/e. Carica tutti gli allegati obbligatori prima di inviare.`,
        }
      }
    }

    // Legge la tariffa km attuale dell'utente per salvarla sul report
    const userKmRow = await db
      .select({ tariffaKm: users.tariffaKm })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    const userTariffaKm = userKmRow[0]?.tariffaKm ?? null

    const now = new Date()
    await db
      .update(expenseReports)
      .set({ status: 'approved', approvedAt: now, updatedAt: now, tariffaKm: userTariffaKm })
      .where(eq(expenseReports.id, reportId))

    revalidatePath(`/expenses/${reportId}`)
    revalidatePath(`/expenses/${reportRows[0].year}/${reportRows[0].month}`)
    revalidatePath('/expenses')
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('submitExpenseReport error:', err)
    return { ok: false, error: 'Errore del server. Riprova.' }
  }
}

// ─── Richiesta rettifica ──────────────────────────────────────────────────────

export async function requestExpenseAmendment(
  reportId: string,
  reason:   string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'EXPENSES_AMENDMENT')
    const userId = session.user.id

    if (!reason.trim()) return { ok: false, error: 'Il motivo è obbligatorio.' }

    const reportRows = await db
      .select({
        id:     expenseReports.id,
        status: expenseReports.status,
        year:   expenseReports.year,
        month:  expenseReports.month,
        title:  expenseReports.title,
      })
      .from(expenseReports)
      .where(and(eq(expenseReports.id, reportId), eq(expenseReports.userId, userId)))
      .limit(1)

    if (!reportRows.length) return { ok: false, error: 'Nota spese non trovata.' }

    const { status, year, month, title } = reportRows[0]
    if (status !== 'approved' && status !== 'amendment_rejected') {
      return { ok: false, error: 'Non è possibile richiedere una rettifica in questo stato.' }
    }

    const now = new Date()
    await db
      .update(expenseReports)
      .set({
        status:               'amendment_requested',
        amendmentRequestedAt: now,
        amendmentReason:      reason.trim(),
        updatedAt:            now,
      })
      .where(eq(expenseReports.id, reportId))

    revalidatePath(`/expenses/${reportId}`)
    revalidatePath('/expenses')

    // Email asincrona a HR Finance
    const { firstName, lastName, email } = session.user
    sendAmendmentRequestedEmail({
      type:        'expense',
      userName:    `${firstName} ${lastName}`,
      userEmail:   email,
      year,
      month,
      reason:      reason.trim(),
      reportTitle: title,
    })

    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('requestExpenseAmendment error:', err)
    return { ok: false, error: 'Errore del server. Riprova.' }
  }
}

// ─── Revisione rettifica (HR Finance) ────────────────────────────────────────

export async function reviewExpenseAmendment(
  reportId:         string,
  action:           'approve' | 'reject',
  rejectionReason?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'FINANCE_AMENDMENT')
    const reviewerId = session.user.id

    if (action === 'reject' && !rejectionReason?.trim()) {
      return { ok: false, error: 'Il motivo del rifiuto è obbligatorio.' }
    }

    const row = await db
      .select({
        id:        expenseReports.id,
        status:    expenseReports.status,
        userId:    expenseReports.userId,
        year:      expenseReports.year,
        month:     expenseReports.month,
        title:     expenseReports.title,
        firstName: users.firstName,
        lastName:  users.lastName,
        email:     users.email,
      })
      .from(expenseReports)
      .innerJoin(users, eq(users.id, expenseReports.userId))
      .where(eq(expenseReports.id, reportId))
      .limit(1)

    if (!row.length) return { ok: false, error: 'Nota spese non trovata.' }
    if (row[0].status !== 'amendment_requested') {
      return { ok: false, error: 'La rettifica non è in attesa di revisione.' }
    }

    const now = new Date()
    await db
      .update(expenseReports)
      .set({
        status:                    action === 'approve' ? 'draft' : 'amendment_rejected',
        amendmentReviewedBy:       reviewerId,
        amendmentReviewedAt:       now,
        amendmentRejectionReason:  action === 'reject' ? rejectionReason!.trim() : null,
        updatedAt:                 now,
      })
      .where(eq(expenseReports.id, reportId))

    revalidatePath('/finance/amendments')

    // Email asincrona all'utente
    sendAmendmentReviewedEmail({
      type:            'expense',
      userEmail:       row[0].email,
      userName:        `${row[0].firstName} ${row[0].lastName}`,
      year:            row[0].year,
      month:           row[0].month,
      action,
      rejectionReason: action === 'reject' ? rejectionReason : undefined,
      reportTitle:     row[0].title,
    })

    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('reviewExpenseAmendment error:', err)
    return { ok: false, error: 'Errore del server. Riprova.' }
  }
}
