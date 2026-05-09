'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, AlertTriangle, CheckCircle2, Send } from 'lucide-react'
import { sendPurchaseOrderReminders } from '@/app/(dashboard)/clients/orders/actions'

type Responsible = {
  responsibleId:    string
  responsibleName:  string
  responsibleEmail: string
  ordersCount:      number
}

type Props = {
  pendingTotal: number   // numero totale di OdA senza posizioni
  responsibles: Responsible[]
  canSend:      boolean  // true solo se l'utente ha PURCHASE_ORDERS_MANAGE
}

export function OdaReminderBanner({ pendingTotal, responsibles, canSend }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  if (pendingTotal === 0) return null

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else              next.add(id)
      return next
    })
  }

  function selectAll() { setSelected(new Set(responsibles.map((r) => r.responsibleId))) }
  function selectNone() { setSelected(new Set()) }

  function handleSend() {
    if (selected.size === 0) return
    setFeedback(null)
    startTransition(async () => {
      const res = await sendPurchaseOrderReminders(Array.from(selected))
      if (res.ok) {
        setFeedback({ ok: true, msg: `Sollecito inviato a ${res.sent} responsabil${res.sent === 1 ? 'e' : 'i'}.` })
        setTimeout(() => {
          setOpen(false)
          setFeedback(null)
          setSelected(new Set())
          router.refresh()
        }, 1800)
      } else {
        setFeedback({ ok: false, msg: res.error })
      }
    })
  }

  return (
    <>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {pendingTotal} OdA {pendingTotal === 1 ? 'senza posizioni' : 'senza posizioni'}
            </p>
            <p className="text-xs text-amber-700">
              {responsibles.length} responsabil{responsibles.length === 1 ? 'e' : 'i'} {responsibles.length === 1 ? 'in attesa' : 'in attesa'}
            </p>
          </div>
        </div>
        {canSend && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ml-auto flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
          >
            <Bell className="h-3.5 w-3.5" />
            Invia sollecito
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Invia sollecito</h2>
              <button type="button" onClick={() => setOpen(false)} disabled={isPending}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <p className="text-sm text-gray-600">
              Seleziona i responsabili a cui inviare il sollecito. Riceveranno una mail con l'elenco delle proprie OdA in attesa di posizioni.
            </p>

            {feedback && (
              <div className={`rounded-lg px-3 py-2 text-sm ${feedback.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'} flex items-start gap-2`}>
                {feedback.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
                <span>{feedback.msg}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{selected.size} di {responsibles.length} selezionat{selected.size === 1 ? 'o' : 'i'}</span>
              <div className="flex gap-3">
                <button type="button" onClick={selectAll} className="text-blue-600 hover:underline">Tutti</button>
                <button type="button" onClick={selectNone} className="text-gray-500 hover:underline">Nessuno</button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {responsibles.map((r) => (
                <label
                  key={r.responsibleId}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(r.responsibleId)}
                    onChange={() => toggle(r.responsibleId)}
                    disabled={isPending}
                    className="h-4 w-4 rounded border-gray-300 text-amber-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.responsibleName}</p>
                    <p className="text-xs text-gray-500 truncate">{r.responsibleEmail}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-semibold">
                    {r.ordersCount}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={isPending || selected.size === 0}
                className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="h-3.5 w-3.5" />
                {isPending ? 'Invio…' : 'Invia'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
