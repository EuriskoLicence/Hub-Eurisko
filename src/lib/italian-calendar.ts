/**
 * Utility calendario italiano — HR Portal
 *
 * Dato un anno e un mese, restituisce ogni giorno del mese con:
 *   date, dayOfWeek, isWeekend, isHoliday, holidayName, isWorkingDay
 *
 * Le festività vengono caricate dal DB e cachate per request (React cache)
 * più un livello di cache in memoria con TTL di 1 ora per evitare query ripetute.
 *
 * Convenzione dayOfWeek: 0 = Domenica, 1 = Lunedì … 6 = Sabato (Date.getDay())
 */

import { cache } from 'react'
import { and, gte, lte } from 'drizzle-orm'
import { db } from '@/db'
import { italianHolidays } from '@/db/schema'

// ─── Tipi pubblici ─────────────────────────────────────────────────────────────

export type CalendarDay = {
  /** Data JavaScript del giorno */
  date:         Date
  /** 0=Dom, 1=Lun, 2=Mar, 3=Mer, 4=Gio, 5=Ven, 6=Sab */
  dayOfWeek:    number
  /** true se sabato (6) o domenica (0) */
  isWeekend:    boolean
  /** true se la data è presente nella tabella italian_holidays */
  isHoliday:    boolean
  /** Nome della festività se isHoliday, altrimenti null */
  holidayName:  string | null
  /** true solo se !isWeekend && !isHoliday */
  isWorkingDay: boolean
  /** Stringa ISO "YYYY-MM-DD" (comoda per confronti) */
  isoDate:      string
}

// ─── Algoritmo di Gauss — Pasqua ──────────────────────────────────────────────

/**
 * Calcola la data di Pasqua per l'anno gregoriano dato,
 * usando l'algoritmo di Gauss (metodo anonimo gregoriano).
 *
 * Accurato per tutti gli anni dal 1583 in poi.
 */
export function gaussEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 1-based
  const day   = ((h + l - 7 * m + 114) % 31) + 1
  // Costruisce la data in UTC per evitare problemi di timezone
  return new Date(Date.UTC(year, month - 1, day))
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Formatta una Date in "YYYY-MM-DD" (UTC) */
export function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Numero di giorni nel mese (gestisce anni bisestili) */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate() // month è 1-based: new Date(y, m, 0) = ultimo giorno di month
}

// ─── Cache in memoria (cross-request, TTL 1 ora) ──────────────────────────────

type HolidayMap = Map<string, string> // "YYYY-MM-DD" → nome festività

const memoryCache = new Map<number, { data: HolidayMap; expiresAt: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 ora

function getCached(year: number): HolidayMap | null {
  const entry = memoryCache.get(year)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(year)
    return null
  }
  return entry.data
}

function setCached(year: number, data: HolidayMap): void {
  memoryCache.set(year, { data, expiresAt: Date.now() + CACHE_TTL_MS })
}

// ─── Caricamento festività dal DB (deduplicato per request con React cache) ───

/**
 * Carica le festività dal DB per l'anno dato.
 * React `cache()` deduplicata le chiamate multiple nella stessa request.
 * Un secondo livello di cache in memoria evita query ripetute tra request.
 */
const loadHolidaysForYear = cache(async (year: number): Promise<HolidayMap> => {
  // Controlla cache in memoria
  const cached = getCached(year)
  if (cached) return cached

  // Query DB: tutte le festività dell'anno
  const start = `${year}-01-01`
  const end   = `${year}-12-31`

  const rows = await db
    .select({ date: italianHolidays.date, name: italianHolidays.name })
    .from(italianHolidays)
    .where(
      and(
        gte(italianHolidays.date, start),
        lte(italianHolidays.date, end),
      ),
    )

  const map: HolidayMap = new Map(rows.map((r) => [r.date, r.name]))
  setCached(year, map)
  return map
})

// ─── Funzione pura (testabile senza DB) ──────────────────────────────────────

/**
 * Costruisce l'array dei giorni del mese data una mappa di festività.
 * Funzione pura, facilmente testabile senza dipendenze esterne.
 *
 * @param year     Anno (es. 2025)
 * @param month    Mese 1-based (1=gennaio … 12=dicembre)
 * @param holidays Mappa "YYYY-MM-DD" → nome festività
 */
export function buildMonthCalendar(
  year:     number,
  month:    number,
  holidays: HolidayMap,
): CalendarDay[] {
  const totalDays = daysInMonth(year, month)
  const days: CalendarDay[] = []

  for (let day = 1; day <= totalDays; day++) {
    const date       = new Date(Date.UTC(year, month - 1, day))
    const dayOfWeek  = date.getUTCDay() // 0=Dom … 6=Sab
    const isWeekend  = dayOfWeek === 0 || dayOfWeek === 6
    const isoDate    = toIsoDate(date)
    const holidayName = holidays.get(isoDate) ?? null
    const isHoliday  = holidayName !== null
    const isWorkingDay = !isWeekend && !isHoliday

    days.push({ date, dayOfWeek, isWeekend, isHoliday, holidayName, isWorkingDay, isoDate })
  }

  return days
}

// ─── API pubblica asincrona ───────────────────────────────────────────────────

/**
 * Restituisce tutti i giorni del mese arricchiti con informazioni calendario.
 * Carica le festività dal DB (con cache) e chiama buildMonthCalendar.
 *
 * @param year   Anno (es. 2025)
 * @param month  Mese 1-based (1=gennaio … 12=dicembre)
 */
export async function getMonthCalendar(
  year:  number,
  month: number,
): Promise<CalendarDay[]> {
  const holidays = await loadHolidaysForYear(year)
  return buildMonthCalendar(year, month, holidays)
}

/**
 * Conta i giorni lavorativi del mese (non weekend, non festività).
 * Utile per il calcolo delle "ore attese" nella griglia timesheet.
 */
export async function countWorkingDays(year: number, month: number): Promise<number> {
  const days = await getMonthCalendar(year, month)
  return days.filter((d) => d.isWorkingDay).length
}

/** Invalida la cache in memoria per l'anno dato (utile dopo modifiche alle festività). */
export function invalidateHolidayCache(year?: number): void {
  if (year !== undefined) {
    memoryCache.delete(year)
  } else {
    memoryCache.clear()
  }
}
