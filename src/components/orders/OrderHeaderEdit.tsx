'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, AlertCircle, Trash2 } from 'lucide-react'
import { updatePurchaseOrder, deletePurchaseOrder } from '@/app/(dashboard)/clients/orders/actions'

type ResponsibleOption = { id: string; name: string; email: string }

type Props = {
  poId:              string
  date:              string
  number:            string
  totalAmount:       string
  responsibleUserId: string
  notes:             string | null
  hasPositions:      boolean
  responsibles:      ResponsibleOption[]
  canManage:         boolean
}

export function OrderHeaderEdit({ poId, date, number, totalAmount, responsibleUserId, notes, hasPositions, responsibles, canManage }: Props) {
  const router = useRouter()
  const [editing,    setEditing]    = useState(false)
  const [isPending,  startTransition] = useTransition()

  const [d,    setD]    = useState(date)
  const [num,  setNum]  = useState(number)
  const [amt,  setAmt]  = useState(totalAmount)
  const [resp, setResp] = useState(responsibleUserId)
  const [nt,   setNt]   = useState(notes ?? '')
  const [error, setError] = useState('')

  function reset() {
    setD(date); setNum(number); setAmt(totalAmount); setResp(responsibleUserId); setNt(notes ?? ''); setError('')
  }

  function handleSave() {
    setError('')
    const newAmt = Number(String(amt).replace(',', '.'))
    if (!isFinite(newAmt) || newAmt < 0) { setError('Importo non valido.'); return }

    const oldAmt = Number(totalAmount)
    const amountChanging = Math.abs(newAmt - oldAmt) > 0.001

    if (amountChanging && hasPositions) {
      const ok = window.confirm(
        "L'OdA ha già delle posizioni. Modificando l'importo totale la somma delle posizioni potrebbe non quadrare e l'OdA verrà marcata come «da rivedere». Procedere?"
      )
      if (!ok) return
    }

    startTransition(async () => {
      const res = await updatePurchaseOrder(poId, {
        date: d,
        number: num.trim(),
        totalAmount: newAmt,
        responsibleUserId: resp,
        notes: nt.trim() || null,
        confirmAmountChange: amountChanging,
      })
      if (res.ok) {
        setEditing(false)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  function handleDelete() {
    if (!window.confirm('Eliminare definitivamente questo OdA? L\'azione è permessa solo se non ci sono posizioni associate.')) return
    startTransition(async () => {
      const res = await deletePurchaseOrder(poId)
      if (res.ok) {
        router.push('/clients/orders')
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  if (!canManage || !editing) {
    return canManage ? (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { reset(); setEditing(true) }}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <Pencil className="h-3 w-3" />
          Modifica testata
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending || hasPositions}
          title={hasPositions ? 'Elimina prima le posizioni' : 'Elimina OdA'}
          className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="h-3 w-3" />
          Elimina OdA
        </button>
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700">{error}</div>}
      </div>
    ) : null
  }

  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Modifica testata</h3>
        <button
          type="button"
          onClick={() => { reset(); setEditing(false) }}
          className="rounded p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
          <input
            type="date"
            value={d}
            onChange={(e) => setD(e.target.value)}
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Numero OdA cliente</label>
          <input
            type="text"
            value={num}
            onChange={(e) => setNum(e.target.value)}
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Importo totale (€)</label>
          <input
            type="number"
            step={0.01}
            min={0}
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500
                       [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Responsabile OdA</label>
          <select
            value={resp}
            onChange={(e) => setResp(e.target.value)}
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {responsibles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
        <textarea
          value={nt}
          onChange={(e) => setNt(e.target.value)}
          rows={2}
          disabled={isPending}
          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => { reset(); setEditing(false) }}
          disabled={isPending}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Annulla
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {isPending ? 'Salvataggio…' : 'Salva testata'}
        </button>
      </div>
    </div>
  )
}
