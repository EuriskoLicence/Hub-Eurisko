import { describe, it, expect } from 'vitest'
import {
  gaussEaster,
  toIsoDate,
  daysInMonth,
  buildMonthCalendar,
} from './italian-calendar'

// ─── gaussEaster ──────────────────────────────────────────────────────────────

describe('gaussEaster', () => {
  // Date di Pasqua verificate da fonti ufficiali
  const knownEasters: [number, string][] = [
    [2020, '2020-04-12'],
    [2021, '2021-04-04'],
    [2022, '2022-04-17'],
    [2023, '2023-04-09'],
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2029, '2029-04-01'],
    [2030, '2030-04-21'],
  ]

  it.each(knownEasters)('calcola correttamente la Pasqua %i → %s', (year, expected) => {
    expect(toIsoDate(gaussEaster(year))).toBe(expected)
  })

  it('calcola la Pasquetta un giorno dopo la Pasqua', () => {
    for (const [year, easterIso] of knownEasters) {
      const easter     = gaussEaster(year)
      const pasquetta  = new Date(easter)
      pasquetta.setUTCDate(pasquetta.getUTCDate() + 1)

      const easterDate    = new Date(easterIso)
      const expectedMonday = new Date(easterDate)
      expectedMonday.setUTCDate(expectedMonday.getUTCDate() + 1)

      expect(toIsoDate(pasquetta)).toBe(toIsoDate(expectedMonday))
    }
  })

  it('restituisce sempre una domenica', () => {
    for (const [year] of knownEasters) {
      const easter = gaussEaster(year)
      expect(easter.getUTCDay()).toBe(0) // 0 = Domenica
    }
  })

  it('non restituisce mai una Pasqua fuori dall\'intervallo marzo-aprile', () => {
    for (const [year] of knownEasters) {
      const month = gaussEaster(year).getUTCMonth() + 1 // 1-based
      expect(month).toBeGreaterThanOrEqual(3)
      expect(month).toBeLessThanOrEqual(4)
    }
  })
})

// ─── toIsoDate ────────────────────────────────────────────────────────────────

describe('toIsoDate', () => {
  it('formatta correttamente la data', () => {
    expect(toIsoDate(new Date(Date.UTC(2025, 0, 1)))).toBe('2025-01-01')
    expect(toIsoDate(new Date(Date.UTC(2025, 11, 31)))).toBe('2025-12-31')
    expect(toIsoDate(new Date(Date.UTC(2024, 2, 31)))).toBe('2024-03-31') // Pasqua 2024
  })

  it('applica zero-padding a mese e giorno singoli', () => {
    expect(toIsoDate(new Date(Date.UTC(2025, 0, 5)))).toBe('2025-01-05')
    expect(toIsoDate(new Date(Date.UTC(2025, 8, 1)))).toBe('2025-09-01')
  })
})

// ─── daysInMonth ──────────────────────────────────────────────────────────────

describe('daysInMonth', () => {
  it('restituisce 31 per i mesi con 31 giorni', () => {
    for (const month of [1, 3, 5, 7, 8, 10, 12]) {
      expect(daysInMonth(2025, month)).toBe(31)
    }
  })

  it('restituisce 30 per i mesi con 30 giorni', () => {
    for (const month of [4, 6, 9, 11]) {
      expect(daysInMonth(2025, month)).toBe(30)
    }
  })

  it('restituisce 28 per febbraio in anno non bisestile', () => {
    expect(daysInMonth(2025, 2)).toBe(28)
    expect(daysInMonth(2023, 2)).toBe(28)
    expect(daysInMonth(2100, 2)).toBe(28) // divisibile per 100 ma non per 400
  })

  it('restituisce 29 per febbraio in anno bisestile', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2000, 2)).toBe(29) // divisibile per 400
  })
})

// ─── buildMonthCalendar ───────────────────────────────────────────────────────

describe('buildMonthCalendar', () => {
  // Gennaio 2025 come mese di riferimento:
  // - 1 gen = Mercoledì (dayOfWeek 3), festività "Capodanno"
  // - 4 gen = Sabato (weekend)
  // - 5 gen = Domenica (weekend)
  // - 6 gen = Lunedì, festività "Epifania"
  const holidays2025jan = new Map([
    ['2025-01-01', 'Capodanno'],
    ['2025-01-06', 'Epifania'],
  ])

  it('restituisce 31 giorni per gennaio 2025', () => {
    const days = buildMonthCalendar(2025, 1, holidays2025jan)
    expect(days).toHaveLength(31)
  })

  it('il 1 gennaio 2025 è mercoledì', () => {
    const days = buildMonthCalendar(2025, 1, holidays2025jan)
    expect(days[0].dayOfWeek).toBe(3) // 3 = Mercoledì
  })

  it('il 1 gennaio 2025 è festività e non è giorno lavorativo', () => {
    const days = buildMonthCalendar(2025, 1, holidays2025jan)
    const jan1 = days[0]
    expect(jan1.isHoliday).toBe(true)
    expect(jan1.holidayName).toBe('Capodanno')
    expect(jan1.isWeekend).toBe(false)
    expect(jan1.isWorkingDay).toBe(false)
  })

  it('il 4 gennaio 2025 è sabato e non è giorno lavorativo', () => {
    const days = buildMonthCalendar(2025, 1, holidays2025jan)
    const jan4 = days[3]
    expect(jan4.dayOfWeek).toBe(6) // 6 = Sabato
    expect(jan4.isWeekend).toBe(true)
    expect(jan4.isHoliday).toBe(false)
    expect(jan4.isWorkingDay).toBe(false)
  })

  it('il 5 gennaio 2025 è domenica e non è giorno lavorativo', () => {
    const days = buildMonthCalendar(2025, 1, holidays2025jan)
    const jan5 = days[4]
    expect(jan5.dayOfWeek).toBe(0) // 0 = Domenica
    expect(jan5.isWeekend).toBe(true)
    expect(jan5.isWorkingDay).toBe(false)
  })

  it('il 6 gennaio 2025 (Epifania, lunedì) è festività e non lavorativo', () => {
    const days = buildMonthCalendar(2025, 1, holidays2025jan)
    const jan6 = days[5]
    expect(jan6.dayOfWeek).toBe(1) // 1 = Lunedì
    expect(jan6.isHoliday).toBe(true)
    expect(jan6.holidayName).toBe('Epifania')
    expect(jan6.isWeekend).toBe(false)
    expect(jan6.isWorkingDay).toBe(false)
  })

  it('il 2 gennaio 2025 (giovedì, nessuna festività) è giorno lavorativo', () => {
    const days = buildMonthCalendar(2025, 1, holidays2025jan)
    const jan2 = days[1]
    expect(jan2.dayOfWeek).toBe(4) // 4 = Giovedì
    expect(jan2.isWeekend).toBe(false)
    expect(jan2.isHoliday).toBe(false)
    expect(jan2.holidayName).toBeNull()
    expect(jan2.isWorkingDay).toBe(true)
  })

  it('isoDate è nel formato corretto per ogni giorno', () => {
    const days = buildMonthCalendar(2025, 1, holidays2025jan)
    expect(days[0].isoDate).toBe('2025-01-01')
    expect(days[30].isoDate).toBe('2025-01-31')
  })

  it('funziona correttamente con mappa di festività vuota', () => {
    const emptyHolidays = new Map<string, string>()
    const days = buildMonthCalendar(2025, 1, emptyHolidays)
    const nonWeekendDays = days.filter((d) => !d.isWeekend)
    // Senza festività, tutti i giorni non-weekend sono lavorativi
    expect(nonWeekendDays.every((d) => d.isWorkingDay)).toBe(true)
    expect(nonWeekendDays.every((d) => !d.isHoliday)).toBe(true)
  })

  // Aprile 2025: Pasqua = 20/04 (domenica), Pasquetta = 21/04 (lunedì)
  it('gestisce correttamente Pasqua e Pasquetta 2025', () => {
    const easterYear  = 2025
    const easter      = gaussEaster(easterYear)
    const pasquettaDate = new Date(easter)
    pasquettaDate.setUTCDate(pasquettaDate.getUTCDate() + 1)

    const holidays = new Map([
      [toIsoDate(easter),       'Pasqua'],
      [toIsoDate(pasquettaDate), 'Pasquetta'],
    ])

    const days = buildMonthCalendar(2025, 4, holidays)

    // Pasqua 20/04 = domenica → isWeekend true, isHoliday true
    const easter20 = days.find((d) => d.isoDate === '2025-04-20')!
    expect(easter20.isWeekend).toBe(true)
    expect(easter20.isHoliday).toBe(true)
    expect(easter20.holidayName).toBe('Pasqua')
    expect(easter20.isWorkingDay).toBe(false)

    // Pasquetta 21/04 = lunedì → isWeekend false, isHoliday true
    const pasquetta21 = days.find((d) => d.isoDate === '2025-04-21')!
    expect(pasquetta21.isWeekend).toBe(false)
    expect(pasquetta21.isHoliday).toBe(true)
    expect(pasquetta21.holidayName).toBe('Pasquetta')
    expect(pasquetta21.isWorkingDay).toBe(false)
  })

  // Febbraio 2024 (anno bisestile)
  it('gestisce correttamente febbraio in anno bisestile (2024)', () => {
    const days = buildMonthCalendar(2024, 2, new Map())
    expect(days).toHaveLength(29)
    expect(days[28].isoDate).toBe('2024-02-29')
  })

  // Febbraio 2025 (anno non bisestile)
  it('gestisce correttamente febbraio in anno non bisestile (2025)', () => {
    const days = buildMonthCalendar(2025, 2, new Map())
    expect(days).toHaveLength(28)
    expect(days[27].isoDate).toBe('2025-02-28')
  })

  it('conta correttamente i giorni lavorativi di gennaio 2025', () => {
    // Gen 2025: 31 giorni
    // Weekend: 4-5, 11-12, 18-19, 25-26 = 8 giorni
    // Festività infrasettimanali: 1 gen (mer), 6 gen (lun) = 2 giorni
    // Giorni lavorativi attesi: 31 - 8 - 2 = 21
    const days = buildMonthCalendar(2025, 1, holidays2025jan)
    const workingDays = days.filter((d) => d.isWorkingDay).length
    expect(workingDays).toBe(21)
  })

  it('la data in ogni CalendarDay corrisponde all\'isoDate', () => {
    const days = buildMonthCalendar(2025, 3, new Map())
    for (const day of days) {
      expect(toIsoDate(day.date)).toBe(day.isoDate)
    }
  })
})
