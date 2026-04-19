/**
 * Test suite per la logica di calcolo spese (funzioni pure estratte dall'ExpenseGrid).
 *
 * Le funzioni sono testate inline qui per non richiedere export dal componente React.
 * Coprono:
 *  - calcAmountEur: importo in valuta → EUR tramite tasso di cambio
 *  - calcKmAmountEur: km × tariffa → EUR
 *  - rowTotal: somma amountEur di tutte le celle di una riga
 *  - grandTotal: somma di tutti i rowTotal
 */

import { describe, it, expect } from 'vitest'

// ─── Funzioni pure (copiate da ExpenseGrid per test isolato) ──────────────────

function calcAmountEur(amount: string, exchangeRate: string): string {
  const a = parseFloat(amount)
  const r = parseFloat(exchangeRate)
  if (isNaN(a) || isNaN(r) || r === 0) return '0.00'
  return (a / r).toFixed(2)
}

function calcKmAmountEur(km: string, ratePerKm: string | null): string {
  if (!ratePerKm) return '0.00'
  const k = parseFloat(km)
  const r = parseFloat(ratePerKm)
  if (isNaN(k) || isNaN(r)) return '0.00'
  return (k * r).toFixed(2)
}

type CellData = { amountEur: string }
type RowState = { cells: Record<number, CellData> }

function rowTotal(row: RowState): number {
  return Object.values(row.cells).reduce((s, c) => s + parseFloat(c.amountEur || '0'), 0)
}

function grandTotal(rows: RowState[]): number {
  return rows.reduce((s, r) => s + rowTotal(r), 0)
}

// ─── calcAmountEur ────────────────────────────────────────────────────────────

describe('calcAmountEur', () => {
  it('restituisce lo stesso importo con tasso 1 (EUR)', () => {
    expect(calcAmountEur('100.00', '1.0000')).toBe('100.00')
    expect(calcAmountEur('37.50', '1.0000')).toBe('37.50')
  })

  it('converte correttamente USD → EUR', () => {
    // 110 USD ÷ 1.10 = 100 EUR
    expect(calcAmountEur('110.00', '1.1000')).toBe('100.00')
  })

  it('converte correttamente GBP → EUR', () => {
    // 85 GBP ÷ 0.85 = 100 EUR
    expect(calcAmountEur('85.00', '0.8500')).toBe('100.00')
  })

  it('arrotonda a 2 decimali', () => {
    // 10 ÷ 3 = 3.333… → 3.33
    expect(calcAmountEur('10.00', '3.0000')).toBe('3.33')
  })

  it('restituisce 0.00 per importo zero', () => {
    expect(calcAmountEur('0.00', '1.0000')).toBe('0.00')
  })

  it('restituisce 0.00 per tasso zero (divisione per zero)', () => {
    expect(calcAmountEur('100.00', '0')).toBe('0.00')
  })

  it('restituisce 0.00 per importo non numerico', () => {
    expect(calcAmountEur('abc', '1.0000')).toBe('0.00')
  })

  it('restituisce 0.00 per tasso non numerico', () => {
    expect(calcAmountEur('100.00', 'xyz')).toBe('0.00')
  })

  it('gestisce importi negativi', () => {
    // Note spese non dovrebbero avere valori negativi, ma la funzione è stabile
    expect(calcAmountEur('-50.00', '1.0000')).toBe('-50.00')
  })
})

// ─── calcKmAmountEur ──────────────────────────────────────────────────────────

describe('calcKmAmountEur', () => {
  it('calcola correttamente rimborso km', () => {
    // 100 km × 0.40 €/km = 40.00 €
    expect(calcKmAmountEur('100', '0.4000')).toBe('40.00')
  })

  it('usa la tariffa ACI (0.3584 €/km)', () => {
    // 50 km × 0.3584 = 17.92
    expect(calcKmAmountEur('50', '0.3584')).toBe('17.92')
  })

  it('restituisce 0.00 per km zero', () => {
    expect(calcKmAmountEur('0', '0.4000')).toBe('0.00')
  })

  it('restituisce 0.00 per ratePerKm null', () => {
    expect(calcKmAmountEur('100', null)).toBe('0.00')
  })

  it('restituisce 0.00 per km non numerico', () => {
    expect(calcKmAmountEur('abc', '0.4000')).toBe('0.00')
  })

  it('arrotonda a 2 decimali', () => {
    // 3 km × 0.3333 = 0.9999 → 1.00
    expect(calcKmAmountEur('3', '0.3333')).toBe('1.00')
  })
})

// ─── rowTotal ─────────────────────────────────────────────────────────────────

describe('rowTotal', () => {
  it('somma correttamente le celle', () => {
    const row: RowState = {
      cells: {
        1: { amountEur: '50.00' },
        5: { amountEur: '30.00' },
        15: { amountEur: '20.00' },
      },
    }
    expect(rowTotal(row)).toBeCloseTo(100.00, 2)
  })

  it('restituisce 0 per riga senza celle', () => {
    expect(rowTotal({ cells: {} })).toBe(0)
  })

  it('gestisce celle con amountEur a 0.00', () => {
    const row: RowState = {
      cells: {
        1: { amountEur: '0.00' },
        2: { amountEur: '25.00' },
      },
    }
    expect(rowTotal(row)).toBeCloseTo(25.00, 2)
  })

  it('gestisce celle con amountEur stringa vuota (come 0)', () => {
    const row: RowState = {
      cells: {
        1: { amountEur: '' },
        2: { amountEur: '15.00' },
      },
    }
    expect(rowTotal(row)).toBeCloseTo(15.00, 2)
  })

  it('somma correttamente un singolo giorno', () => {
    const row: RowState = { cells: { 10: { amountEur: '123.45' } } }
    expect(rowTotal(row)).toBeCloseTo(123.45, 2)
  })
})

// ─── grandTotal ───────────────────────────────────────────────────────────────

describe('grandTotal', () => {
  it('somma i totali di tutte le righe', () => {
    const rows: RowState[] = [
      { cells: { 1: { amountEur: '100.00' }, 2: { amountEur: '50.00' } } },
      { cells: { 3: { amountEur: '75.00' } } },
    ]
    expect(grandTotal(rows)).toBeCloseTo(225.00, 2)
  })

  it('restituisce 0 per array vuoto', () => {
    expect(grandTotal([])).toBe(0)
  })

  it('restituisce 0 per righe senza celle', () => {
    const rows: RowState[] = [{ cells: {} }, { cells: {} }]
    expect(grandTotal(rows)).toBe(0)
  })

  it('gestisce righe miste (alcune con celle, alcune vuote)', () => {
    const rows: RowState[] = [
      { cells: { 1: { amountEur: '200.00' } } },
      { cells: {} },
      { cells: { 5: { amountEur: '50.00' } } },
    ]
    expect(grandTotal(rows)).toBeCloseTo(250.00, 2)
  })

  it('è commutativo rispetto all\'ordine delle righe', () => {
    const rowA: RowState = { cells: { 1: { amountEur: '80.00' } } }
    const rowB: RowState = { cells: { 2: { amountEur: '120.00' } } }
    expect(grandTotal([rowA, rowB])).toBeCloseTo(grandTotal([rowB, rowA]), 2)
  })
})
