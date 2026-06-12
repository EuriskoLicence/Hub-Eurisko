'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveInvoiceLines } from '@/app/(dashboard)/clients/invoices/actions'

type LineRow = {
  id?:                   string
  lineNumber?:           number  // assegnato server-side; '—' per nuove righe
  isOdaRelated:          boolean
  isTravelReimbursement: boolean
  description:           string
  amount:                string  // string per controllo input
  purchaseOrderLineId:   string
}

type OdaLineOption = { id: string; label: string; inactive?: boolean }

type Props = {
  invoiceId:    string
  totalAmount:  string   // testata
  vatAmount:    string   // testata
  currency:     string
  initialLines: {
    id: string
    lineNumber: number
    isOdaRelated: boolean
    isTravelReimbursement: boolean
    description: string
    amount: string
    purchaseOrderLineId: string | null
  }[]
  odaLines:  OdaLineOption[]
  canManage: boolean
}

function num(s: string): number {
  const v = Number(String(s).replace(',', '.'))
  return isFinite(v) ? v : 0
}

export function InvoiceLinesGrid({ invoiceId, totalAmount, vatAmount, currency, initialLines, odaLines, canManage }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  const [rows, setRows] = useState<LineRow[]>(() =>
    initialLines.map((l) => ({
      id:                    l.id,
      lineNumber:            l.lineNumber,
      isOdaRelated:          l.isOdaRelated,
      isTravelReimbursement: l.isTravelReimbursement,
      description:           l.description,
      amount:                l.amount,
      purchaseOrderLineId:   l.purchaseOrderLineId ?? '',
    })),
  )

  function fmtCur(n: number) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(n)
  }

  const expected = useMemo(() => num(totalAmount) - num(vatAmount), [totalAmount, vatAmount])
  const sum      = useMemo(() => rows.reduce((s, r) => s + num(r.amount), 0), [rows])
  const diff     = sum - expected
  const balanced = Math.abs(diff) < 0.01

  function addRow() {
    setRows((prev) => [...prev, {
      isOdaRelated:          true,   // default ATTIVO (richiesta capo)
      isTravelReimbursement: false,  // default non valorizzato
      description:           '',
      amount:                '',
      purchaseOrderLineId:   '',
    }])
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  function update(idx: number, patch: Partial<LineRow>) {
    setRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r
      const next = { ...r, ...patch }
      // Togliendo il flag OdA si pulisce l'abbinamento
      if (patch.isOdaRelated === false) next.purchaseOrderLineId = ''
      return next
    }))
  }

  function handleSave() {
    setError('')
    if (rows.length === 0) { setError('Inserire almeno una posizione.'); return }
    if (!balanced) {
      setError(`La somma delle posizioni (${fmtCur(sum)}) non corrisponde a Totale Documento − IVA (${fmtCur(expected)}).`)
      return
    }
    for (const r of rows) {
      if (!r.description.trim())                  { setError('Tutte le posizioni devono avere un testo.'); return }
      if (num(r.amount) === 0)                    { setError('Tutti gli importi devono essere diversi da 0.'); return }
      if (r.isOdaRelated && !r.purchaseOrderLineId) { setError('Le posizioni riferite a OdA devono avere una posizione OdA abbinata.'); return }
    }

    startTransition(async () => {
      const res = await saveInvoiceLines(invoiceId, rows.map((r) => ({
        id:                    r.id,
        isOdaRelated:          r.isOdaRelated,
        isTravelReimbursement: r.isTravelReimbursement,
        description:           r.description.trim(),
        amount:                num(r.amount),
        purchaseOrderLineId:   r.isOdaRelated ? r.purchaseOrderLineId : null,
      })))
      if (res.ok) {
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 2000)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {savedFlash && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          Posizioni salvate correttamente.
        </div>
      )}

      {/* Tabella desktop */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-600 w-12">N.</th>
              <th className="text-center px-3 py-2 font-medium text-gray-600 w-20">Rif. OdA</th>
              <th className="text-center px-3 py-2 font-medium text-gray-600 w-24">Rimb. trasferte</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Testo posizione</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">Importo</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Posizione OdA</th>
              {canManage && <th className="w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-400">
                  Nessuna posizione. Aggiungine una.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.id ?? `new-${i}`} className="align-top">
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{r.lineNumber ?? '—'}</td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={r.isOdaRelated}
                    onChange={(e) => update(i, { isOdaRelated: e.target.checked })}
                    disabled={!canManage || isPending}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={r.isTravelReimbursement}
                    onChange={(e) => update(i, { isTravelReimbursement: e.target.checked })}
                    disabled={!canManage || isPending}
                    className="h-4 w-4 rounded border-gray-300 text-teal-600"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={r.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                    disabled={!canManage || isPending}
                    placeholder="Descrizione"
                    className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step={0.01}
                    value={r.amount}
                    onChange={(e) => update(i, { amount: e.target.value })}
                    disabled={!canManage || isPending}
                    className="w-full rounded border border-gray-200 px-2 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50
                               [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                <td className="px-3 py-2">
                  {r.isOdaRelated ? (
                    <select
                      value={r.purchaseOrderLineId}
                      onChange={(e) => update(i, { purchaseOrderLineId: e.target.value })}
                      disabled={!canManage || isPending}
                      className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
                    >
                      <option value="">Seleziona…</option>
                      {odaLines.map((o) => (
                        <option key={o.id} value={o.id} disabled={o.inactive}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                {canManage && (
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      disabled={isPending}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="Rimuovi"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Card mobile */}
      <div className="md:hidden space-y-2">
        {rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400">
            Nessuna posizione.
          </div>
        )}
        {rows.map((r, i) => (
          <div key={r.id ?? `new-${i}`} className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-gray-500">
                {r.lineNumber ? `Posizione ${r.lineNumber}` : 'Nuova posizione'}
              </span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={isPending}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={r.isOdaRelated}
                  onChange={(e) => update(i, { isOdaRelated: e.target.checked })}
                  disabled={!canManage || isPending}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                Rif. OdA
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={r.isTravelReimbursement}
                  onChange={(e) => update(i, { isTravelReimbursement: e.target.checked })}
                  disabled={!canManage || isPending}
                  className="h-4 w-4 rounded border-gray-300 text-teal-600"
                />
                Rimb. trasferte
              </label>
            </div>
            <input
              type="text"
              value={r.description}
              onChange={(e) => update(i, { description: e.target.value })}
              placeholder="Testo posizione"
              disabled={!canManage || isPending}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-base focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
            />
            <div className="flex gap-2">
              <input
                type="number"
                step={0.01}
                value={r.amount}
                onChange={(e) => update(i, { amount: e.target.value })}
                disabled={!canManage || isPending}
                placeholder="0.00"
                className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-base text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
              />
              <span className="text-base text-gray-400 self-center">{currency}</span>
            </div>
            {r.isOdaRelated && (
              <select
                value={r.purchaseOrderLineId}
                onChange={(e) => update(i, { purchaseOrderLineId: e.target.value })}
                disabled={!canManage || isPending}
                className="w-full rounded border border-gray-200 px-2 py-1.5 text-base focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
              >
                <option value="">Seleziona posizione OdA…</option>
                {odaLines.map((o) => (
                  <option key={o.id} value={o.id} disabled={o.inactive}>{o.label}</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      {/* Footer: quadratura e azioni */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex flex-col text-sm">
          <span className="text-gray-500">
            Somma posizioni: <span className="font-semibold text-gray-900 tabular-nums">{fmtCur(sum)}</span>
            <span className="ml-2 text-gray-400">/ Totale − IVA: <span className="font-semibold text-gray-700 tabular-nums">{fmtCur(expected)}</span></span>
          </span>
          <span className={cn('text-xs font-medium', balanced ? 'text-green-600' : 'text-red-600')}>
            {balanced
              ? '✓ Quadrato'
              : `Differenza: ${diff > 0 ? '+' : ''}${fmtCur(diff)}`}
          </span>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addRow}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Aggiungi posizione
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || rows.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {isPending ? 'Salvataggio…' : 'Salva posizioni'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
