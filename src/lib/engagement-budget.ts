/**
 * Utility: verifica se le commesse hanno superato il budget di ore.
 * Legge lo stato ATTUALE del DB (chiamare DOPO aver salvato le entries).
 * Commesse con totalHours >= 999999 sono trattate come "illimitate" e ignorate.
 */

import { db } from '@/db'
import { engagements, timesheetEntries, timesheetExtraEntries } from '@/db/schema'
import { sql } from 'drizzle-orm'

export type BudgetWarning = {
  engagementName: string
  budgetHours:    number
  usedHours:      number
}

/** Helper: `col = ANY(ARRAY[...::uuid])` per colonne uuid (anche nullable) */
function inUuids(col: any, ids: string[]) {
  return sql`${col} = ANY(ARRAY[${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)}])`
}

export async function checkEngagementBudgets(
  engagementIds: string[],
): Promise<BudgetWarning[]> {
  if (engagementIds.length === 0) return []

  const [engRows, regularSums, extraSums] = await Promise.all([
    // Budget per commessa
    db
      .select({ id: engagements.id, name: engagements.name, totalHours: engagements.totalHours })
      .from(engagements)
      .where(inUuids(engagements.id, engagementIds)),

    // Totale da consuntivazione normale (tutti gli utenti, tutti i mesi)
    db
      .select({
        engagementId: timesheetEntries.engagementId,
        total:        sql<number>`cast(coalesce(sum(${timesheetEntries.hours}), 0) as int)`,
      })
      .from(timesheetEntries)
      .where(inUuids(timesheetEntries.engagementId, engagementIds))
      .groupBy(timesheetEntries.engagementId),

    // Totale da consuntivazione extra (tutti gli utenti, tutti i mesi)
    db
      .select({
        engagementId: timesheetExtraEntries.engagementId,
        total:        sql<number>`cast(coalesce(sum(${timesheetExtraEntries.hours}), 0) as int)`,
      })
      .from(timesheetExtraEntries)
      .where(inUuids(timesheetExtraEntries.engagementId, engagementIds))
      .groupBy(timesheetExtraEntries.engagementId),
  ])

  const regularMap = new Map(regularSums.map((r) => [r.engagementId, Number(r.total)]))
  const extraMap   = new Map(extraSums.map((r)   => [r.engagementId, Number(r.total)]))

  const warnings: BudgetWarning[] = []
  for (const eng of engRows) {
    if (eng.totalHours >= 999999) continue  // illimitato → skip
    const usedHours = (regularMap.get(eng.id) ?? 0) + (extraMap.get(eng.id) ?? 0)
    if (usedHours > eng.totalHours) {
      warnings.push({ engagementName: eng.name, budgetHours: eng.totalHours, usedHours })
    }
  }
  return warnings
}
