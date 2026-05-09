'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save, AlertCircle, CheckCircle2 } from 'lucide-react'
import { savePurchaseOrderLines } from '@/app/(dashboard)/clients/orders/actions'

type LineRow = {
  id?:               string
  code?:             string  // mostrato solo per righe esistenti (server-side)
  externalReference: string
  description:       string
  amount:            string  // tenuto come stringa per controllo input
  engagementId:      string
  statusId:          string
  __isNew?:          boolean
}

type EngagementOption = { id: string; label: string }
type LineStatusOption = { id: string; code: string; description: string }

type Props = {
  purchaseOrderId: string
  totalAmount:     string                      // testata
  initialLines:    {
    id: string; code: string;
    externalReference: string | null;
    description: string;
    amount: string;
    engagementId: string;
    statusId: string | null;
  }[]
  engagements:     EngagementOption[]
  lineStatuses:    LineStatusOption[]
  canManage:       boolean
}

function num(s: string): number {
  const v = Number(String(s).replace(',', '.'))
  return isFinite(v) ? v : 0
}
function fmtEur(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}

export function OrderLinesGrid({ purchaseOrderId, totalAmount, initialLines, engagements, lineStatuses, canManage }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  const [rows, setRows] = useState<LineRow[]>(() =>
    initialLines.map((l) => ({
      id:                l.id,
      code:              l.code,
      externalReference: l.externalReference ?? '',
      description:       l.description,
      amount:            l.amount,
      engagementId:      l.engagementId,
      statusId:          l.statusId ?? '',
    })),
  )

  const total = useMemo(() => num(totalAmount), [totalAmount])
  const sum   = useMemo(() => rows.reduce((s, r) => s + num(r.amount), 0), [rows])
  const diff  = sum - total
  const balanced = Math.abs(diff) < 0.01

  function addRow() {
    setRows((prev) => [...prev, {
      externalReference: '',
      description:       '',
      amount:            '',
      engagementId:      '',
      statusId:          '',
      __isNew:           true,
    }])
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  function update(idx: number, patch: Partial<LineRow>) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  function handleSave() {
    setError('')
    if (rows.length === 0) { setError('Inserire almeno una posizione.'); return }
    if (!balanced)         { setError(`La somma posizioni (${fmtEur(sum)}) non corrisponde al totale OdA (${fmtEur(total)}).`); return }
    for (const r of rows) {
      if (!r.description.trim()) { setError('Tutte le posizioni devono avere una descrizione.'); return }
      if (num(r.amount) <= 0)    { setError('Tutti gli importi devono essere maggiori di 0.'); return }
      if (!r.engagementId)       { setError('Tutte le posizioni devono avere una commessa.'); return }
    }

    startTransition(async () => {
      const res = await savePurchaseOrderLines(purchaseOrderId, rows.map((r) => ({
        id:                r.id,
        externalReference: r.externalReference.trim() || null,
        description:       r.description.trim(),
        amount:            num(r.amount),
        engagementId:      r.engagementId,
        statusId:          r.statusId || null,
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

  if (engagements.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-5 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-amber-500 mb-2" />
        <p className="text-sm text-amber-800">
          Nessuna commessa disponibile per il cliente di questo OdA.<br />
          Verifica che esistano commesse <strong>attive, non concluse e con tipologia non &laquo;NO OdA&raquo;</strong>.
        </p>
      </div>
    )
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
              <th className="text-left px-3 py-2 font-medium text-gray-600 w-16">Cod.</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Riferimento</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Descrizione</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">Importo (€)</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Commessa</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600 w-32">Stato</th>
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
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{r.code ?? '—'}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={r.externalReference}
                    onChange={(e) => update(i, { externalReference: e.target.value })}
                    disabled={!canManage || isPending}
                    placeholder="rif. esterno"
                    className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={r.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                    disabled={!canManage || isPending}
                    placeholder="Descrizione"
                    className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    value={r.amount}
                    onChange={(e) => update(i, { amount: e.target.value })}
                    disabled={!canManage || isPending}
                    className="w-full rounded border border-gray-200 px-2 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50
                               [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={r.engagementId}
                    onChange={(e) => update(i, { engagementId: e.target.value })}
                    disabled={!canManage || isPending}
                    className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                  >
                    <option value="">Seleziona…</option>
                    {engagements.map((e) => (
                      <option key={e.id} value={e.id}>{e.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={r.statusId}
                    onChange={(e) => update(i, { statusId: e.target.value })}
                    disabled={!canManage || isPending}
                    className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                  >
                    <option value="">—</option>
                    {lineStatuses.map((s) => (
                      <option key={s.id} value={s.id}>{s.code} — {s.description}</option>
                    ))}
                  </select>
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
              <span className="font-mono text-xs text-gray-500">{r.code ?? 'Nuova posizione'}</span>
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
            <input
              type="text"
              value={r.externalReference}
              onChange={(e) => update(i, { externalReference: e.target.value })}
              placeholder="Riferimento esterno"
              disabled={!canManage || isPending}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-base focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
            />
            <input
              type="text"
              value={r.description}
              onChange={(e) => update(i, { description: e.target.value })}
              placeholder="Descrizione"
              disabled={!canManage || isPending}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-base focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
            />
            <div className="flex gap-2">
              <input
                type="number"
                step={0.01}
                min={0}
                value={r.amount}
                onChange={(e) => update(i, { amount: e.target.value })}
                disabled={!canManage || isPending}
                placeholder="0.00"
                className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-base text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
              />
              <span className="text-base text-gray-400 self-center">€</span>
            </div>
            <select
              value={r.engagementId}
              onChange={(e) => update(i, { engagementId: e.target.value })}
              disabled={!canManage || isPending}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-base focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
            >
              <option value="">Seleziona commessa…</option>
              {engagements.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
            <select
              value={r.statusId}
              onChange={(e) => update(i, { statusId: e.target.value })}
              disabled={!canManage || isPending}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-base focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
            >
              <option value="">— Stato (facoltativo) —</option>
              {lineStatuses.map((s) => (
                <option key={s.id} value={s.id}>{s.code} — {s.description}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Footer: totali e azioni */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex flex-col text-sm">
          <span className="text-gray-500">
            Somma posizioni: <span className="font-semibold text-gray-900 tabular-nums">{fmtEur(sum)}</span>
            <span className="ml-2 text-gray-400">/ Totale OdA: <span className="font-semibold text-gray-700 tabular-nums">{fmtEur(total)}</span></span>
          </span>
          <span className={balanced ? 'text-green-600 text-xs font-medium' : 'text-red-600 text-xs font-medium'}>
            {balanced
              ? '✓ Quadrato'
              : `Differenza: ${diff > 0 ? '+' : ''}${fmtEur(diff)}`}
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
              className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
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
