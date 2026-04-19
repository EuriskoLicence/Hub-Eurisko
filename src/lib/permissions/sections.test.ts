/**
 * Test suite per src/lib/permissions/sections.ts
 *
 * Verifica la coerenza interna di SECTIONS e SECTIONS_META:
 * - ogni sezione in SECTIONS ha un entry in SECTIONS_META
 * - i sortOrder sono unici e coprono 1..N
 * - le aree sono un sottoinsieme di valori attesi
 * - label e description sono non vuoti
 */

import { describe, it, expect } from 'vitest'
import { SECTIONS, SECTIONS_META } from './sections'
import type { SectionCode } from './sections'

const SECTION_CODES = Object.keys(SECTIONS) as SectionCode[]
const EXPECTED_AREAS = ['Consuntivazione', 'Nota spese', 'Clienti', 'HR Finance', 'Parametrizzazioni']

describe('SECTIONS', () => {
  it('contiene almeno 15 sezioni', () => {
    expect(SECTION_CODES.length).toBeGreaterThanOrEqual(15)
  })

  it('i valori coincidono con le chiavi (code === key)', () => {
    for (const code of SECTION_CODES) {
      expect(SECTIONS[code]).toBe(code)
    }
  })

  it('include le sezioni fondamentali', () => {
    const required: SectionCode[] = [
      'TIMESHEET', 'TIMESHEET_AMENDMENT',
      'EXPENSES',  'EXPENSES_AMENDMENT',
      'CLIENTS_VIEW', 'CLIENTS_MANAGE',
      'FINANCE_DASHBOARD', 'FINANCE_AMENDMENT', 'FINANCE_EXPORT',
      'PARAM_USERS', 'PARAM_ROLES',
    ]
    for (const code of required) {
      expect(SECTION_CODES).toContain(code)
    }
  })
})

describe('SECTIONS_META', () => {
  it('ha un entry per ogni sezione in SECTIONS', () => {
    for (const code of SECTION_CODES) {
      expect(SECTIONS_META[code], `SECTIONS_META manca la sezione ${code}`).toBeDefined()
    }
  })

  it('non ha entry extra non presenti in SECTIONS', () => {
    const metaKeys = Object.keys(SECTIONS_META)
    for (const key of metaKeys) {
      expect(SECTION_CODES).toContain(key as SectionCode)
    }
  })

  it('ogni entry ha label non vuota', () => {
    for (const code of SECTION_CODES) {
      expect(SECTIONS_META[code].label.trim()).not.toBe('')
    }
  })

  it('ogni entry ha description non vuota', () => {
    for (const code of SECTION_CODES) {
      expect(SECTIONS_META[code].description.trim()).not.toBe('')
    }
  })

  it('i sortOrder sono tutti distinti', () => {
    const orders = SECTION_CODES.map((c) => SECTIONS_META[c].sortOrder)
    const unique  = new Set(orders)
    expect(unique.size).toBe(orders.length)
  })

  it('i sortOrder coprono 1..N senza buchi', () => {
    const orders = SECTION_CODES.map((c) => SECTIONS_META[c].sortOrder).sort((a, b) => a - b)
    orders.forEach((order, i) => {
      expect(order).toBe(i + 1)
    })
  })

  it('ogni area appartiene all\'insieme delle aree attese', () => {
    for (const code of SECTION_CODES) {
      expect(EXPECTED_AREAS).toContain(SECTIONS_META[code].area)
    }
  })

  it('ogni area attesa ha almeno una sezione', () => {
    for (const area of EXPECTED_AREAS) {
      const hasArea = SECTION_CODES.some((c) => SECTIONS_META[c].area === area)
      expect(hasArea, `Nessuna sezione per l'area "${area}"`).toBe(true)
    }
  })
})
