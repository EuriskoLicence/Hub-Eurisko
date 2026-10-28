/**
 * Coerenza tra lo stato posizione OdA (impostato a mano) e gli importi
 * effettivamente fatturati nella sezione Fatturazione.
 * Modulo plain (non 'use server'): condiviso dai report "Lista OdA" e "OdA per commessa"
 * (pagine ed export Excel).
 *
 * Stato atteso in base agli importi (tolleranza 0,01 €):
 *   fatturato = 0                → AUT
 *   0 < fatturato < importo      → PAR
 *   fatturato = importo          → INV
 * Gestiti solo i codici AUT / PAR / INV (stessa convenzione della whitelist
 * in clients/invoices/actions.ts); altri codici non vengono valutati.
 */

const EPS = 0.01

const MANAGED_STATUSES = ['AUT', 'PAR', 'INV'] as const
type ManagedStatus = (typeof MANAGED_STATUSES)[number]

const EXPECTED_DESCR: Record<ManagedStatus, string> = {
  AUT: 'nessuna fattura registrata',
  PAR: 'fatturata solo in parte',
  INV: 'fatturata per intero',
}

export type CoherenceKind =
  | 'ok'        // stato coerente con gli importi
  | 'mismatch'  // stato diverso da quello atteso
  | 'missing'   // posizione fatturata ma senza stato
  | 'over'      // fatturato oltre l'importo della posizione OdA
  | 'negative'  // note credito superiori alle fatture
  | 'na'        // nulla da valutare (nessuna posizione, dati non visibili, stato non gestito)

export type Coherence = {
  kind:      CoherenceKind
  label:     string
  expected?: ManagedStatus
}

export function checkCoherence(
  statusCode: string | null,
  amount:     number | null,
  invoiced:   number | null,
): Coherence {
  if (amount === null || invoiced === null) return { kind: 'na', label: '' }

  const residual = amount - invoiced
  if (invoiced < -EPS) return { kind: 'negative', label: 'Note credito superiori al fatturato' }
  if (residual < -EPS) return { kind: 'over',     label: "Fatturato oltre l'importo OdA" }

  const expected: ManagedStatus = invoiced <= EPS ? 'AUT' : residual > EPS ? 'PAR' : 'INV'

  if (!statusCode) {
    return expected === 'AUT'
      ? { kind: 'na', label: '' }
      : { kind: 'missing', expected, label: `Senza stato ma ${EXPECTED_DESCR[expected]} (atteso ${expected})` }
  }

  if (!(MANAGED_STATUSES as readonly string[]).includes(statusCode)) return { kind: 'na', label: '' }
  if (statusCode === expected) return { kind: 'ok', label: 'Coerente' }

  return {
    kind: 'mismatch',
    expected,
    label: `${statusCode} ma ${EXPECTED_DESCR[expected]} (atteso ${expected})`,
  }
}

/** True per le righe da segnalare all'utente. */
export function isCoherenceIssue(c: Coherence): boolean {
  return c.kind === 'mismatch' || c.kind === 'missing' || c.kind === 'over' || c.kind === 'negative'
}

/** True se tra i documenti abbinati c'è una divisa diversa da quella dell'OdA (EUR). */
export function hasForeignCurrency(currencies: string[]): boolean {
  return currencies.some((c) => c !== 'EUR')
}
