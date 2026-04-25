/**
 * Utility: verifica se le commesse supererebbero il budget di ore.
 * Chiamare PRIMA di salvare le entries (check preventivo, blocca il salvataggio).
 * Commesse con totalHours >= 999999 sono trattate come "illimitate" e ignorate.
 */

import { db } from '@/db'
import { engagements, timesheetEntries, timesheetExtraEntries } from '@/db/schema'
import { and, or, ne, sql } from 'drizzle-orm'

/** `col = ANY(ARRAY[...::uuid])` per colonne uuid anche nullable */
function inUuids(col: any, ids: string[]) {
  return sql`${col} = ANY(ARRAY[${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)}])`
}

/**
 * Controlla se salvare `newHours` farebbe superare il budget di una o più commesse.
 *
 * @param newHours       Mappa engagementId → ore che si sta per salvare
 * @param excludeRegular Esclude le entry (userId, year, month) dalla tabella normale
 *                       (perché verranno rimpiazzate dal salvataggio in corso)
 * @param excludeExtra   Esclude le entry (userId, year, month) dalla tabella extra
 */
export async function checkEngagementBudgets(opts: {
  newHours:        Record<string, number>
  excludeRegular?: { userId: string; year: number; month: number }
  excludeExtra?:   { userId: string; year: number; month: number }
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { newHours, excludeRegular, excludeExtra } = opts
  const engagementIds = Object.keys(newHours)
  if (engagementIds.length === 0) return { ok: true }

  // 1. Budget delle commesse coinvolte
  const engRows = await db
    .select({ id: engagements.id, name: engagements.name, totalHours: engagements.totalHours })
    .from(engagements)
    .where(inUuids(engagements.id, engagementIds))

  // Filtra le commesse con limite reale (< 999999)
  const limited = engRows.filter((e) => e.totalHours < 999999)
  if (limited.length === 0) return { ok: true }

  const limitedIds = limited.map((e) => e.id)

  // 2. Ore esistenti nella tabella normale (escludo il mese corrente dell'utente se indicato)
  const regularExclude = excludeRegular
    ? or(
        ne(timesheetEntries.userId, excludeRegular.userId),
        ne(timesheetEntries.year,   excludeRegular.year),
        ne(timesheetEntries.month,  excludeRegular.month),
      )
    : undefined

  // 3. Ore esistenti nella tabella extra (escludo il mese corrente dell'utente se indicato)
  const extraExclude = excludeExtra
    ? or(
        ne(timesheetExtraEntries.userId, excludeExtra.userId),
        ne(timesheetExtraEntries.year,   excludeExtra.year),
        ne(timesheetExtraEntries.month,  excludeExtra.month),
      )
    : undefined

  const [regularSums, extraSums] = await Promise.all([
    db
      .select({
        engagementId: timesheetEntries.engagementId,
        total:        sql<number>`cast(coalesce(sum(${timesheetEntries.hours}), 0) as int)`,
      })
      .from(timesheetEntries)
      .where(and(inUuids(timesheetEntries.engagementId, limitedIds), regularExclude))
      .groupBy(timesheetEntries.engagementId),

    db
      .select({
        engagementId: timesheetExtraEntries.engagementId,
        total:        sql<number>`cast(coalesce(sum(${timesheetExtraEntries.hours}), 0) as int)`,
      })
      .from(timesheetExtraEntries)
      .where(and(inUuids(timesheetExtraEntries.engagementId, limitedIds), extraExclude))
      .groupBy(timesheetExtraEntries.engagementId),
  ])

  const regularMap = new Map(regularSums.map((r) => [r.engagementId, Number(r.total)]))
  const extraMap   = new Map(extraSums.map((r)   => [r.engagementId, Number(r.total)]))

  // 4. Calcola totale (esistente + nuovo) e trova sforamenti
  const exceeded: { name: string; used: number; budget: number }[] = []
  for (const eng of limited) {
    const existing  = (regularMap.get(eng.id) ?? 0) + (extraMap.get(eng.id) ?? 0)
    const afterSave = existing + (newHours[eng.id] ?? 0)
    if (afterSave > eng.totalHours) {
      exceeded.push({ name: eng.name, used: afterSave, budget: eng.totalHours })
    }
  }

  if (exceeded.length === 0) return { ok: true }

  const detail = exceeded
    .map((e) => `${e.name} (${e.used}h su ${e.budget}h di budget)`)
    .join('; ')
  return { ok: false, error: `Budget ore superato: ${detail}.` }
}
