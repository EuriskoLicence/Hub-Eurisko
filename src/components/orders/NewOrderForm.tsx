'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Calendar, Hash, Building2, Euro, User, FileText, AlertCircle } from 'lucide-react'
import { OrderAttachmentsList, type AttachmentItem } from './OrderAttachmentsList'
import { createPurchaseOrder } from '@/app/(dashboard)/clients/orders/actions'

type ClientOption       = { id: string; name: string; code: string }
type ResponsibleOption  = { id: string; name: string; email: string }

type Props = {
  clients:       ClientOption[]
  responsibles:  ResponsibleOption[]
}

// UUID v4 polyfill (browser hanno crypto.randomUUID di solito)
function newUuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID()
  }
  // fallback semplice
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function NewOrderForm({ clients, responsibles }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // id pre-generato per coerenza con path R2 degli allegati
  const [poId] = useState(() => newUuid())

  const today = new Date().toISOString().split('T')[0]
  const [date,        setDate]        = useState(today)
  const [number,      setNumber]      = useState('')
  const [clientId,    setClientId]    = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [respId,      setRespId]      = useState('')
  const [notes,       setNotes]       = useState('')
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [error,       setError]       = useState('')

  const totalNum = useMemo(() => Number(totalAmount.replace(',', '.')) || 0, [totalAmount])
  const canSubmit = !!date && !!number.trim() && !!clientId && totalNum > 0 && !!respId && attachments.length >= 1

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!canSubmit) {
      setError('Compila tutti i campi obbligatori e carica almeno un allegato.')
      return
    }
    startTransition(async () => {
      const res = await createPurchaseOrder({
        id:                poId,
        date,
        number:            number.trim(),
        clientId,
        totalAmount:       totalNum,
        responsibleUserId: respId,
        notes:             notes.trim() || null,
        attachments,
      })
      if (res.ok) {
        router.push(`/clients/orders/${res.id}`)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field icon={Calendar} label="Data *">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </Field>
        <Field icon={Hash} label="Numero OdA cliente *">
          <input
            type="text"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="es. PO-2026-001"
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </Field>
      </div>

      <Field icon={Building2} label="Cliente *">
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          disabled={isPending}
          className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Seleziona cliente…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field icon={Euro} label="Importo totale (EUR) *">
          <input
            type="number"
            min={0}
            step={0.01}
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="0.00"
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500
                       [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
        </Field>
        <Field icon={User} label="Responsabile OdA *">
          <select
            value={respId}
            onChange={(e) => setRespId(e.target.value)}
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Seleziona responsabile…</option>
            {responsibles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">Solo utenti con permesso "Gestione OdA"</p>
        </Field>
      </div>

      <Field icon={FileText} label="Note">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          disabled={isPending}
          placeholder="Eventuali note interne…"
          className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
        />
      </Field>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Allegati * <span className="text-gray-400 font-normal">(almeno 1)</span>
        </label>
        <OrderAttachmentsList
          purchaseOrderId={poId}
          attachments={attachments}
          disabled={isPending}
          enforceMinOne={false}
          onUploaded={(att) => setAttachments((prev) => [...prev, att])}
          onRemoved={(att) => setAttachments((prev) => prev.filter((a) => a.key !== att.key))}
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={() => router.push('/clients/orders')}
          disabled={isPending}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Annulla
        </button>
        <button
          type="submit"
          disabled={!canSubmit || isPending}
          className="flex-1 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
        >
          <ShoppingCart className="inline h-4 w-4 mr-2 -mt-0.5" />
          {isPending ? 'Creazione…' : 'Crea OdA'}
        </button>
      </div>
    </form>
  )
}

function Field({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-gray-400" />
        {label}
      </label>
      {children}
    </div>
  )
}
