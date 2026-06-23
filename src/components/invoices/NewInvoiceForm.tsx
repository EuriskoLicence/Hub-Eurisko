'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Calendar, Hash, Building2, Euro, AlertCircle, Percent } from 'lucide-react'
import { OrderAttachmentsList, type AttachmentItem } from '@/components/orders/OrderAttachmentsList'
import { createInvoice, type InvoiceType } from '@/app/(dashboard)/clients/invoices/actions'

type ClientOption = { id: string; name: string; code: string }

type Props = {
  clients: ClientOption[]
}

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const

function newUuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function NewInvoiceForm({ clients }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // id pre-generato per coerenza con il path R2 degli allegati
  const [invoiceId] = useState(() => newUuid())

  const today = new Date().toISOString().split('T')[0]
  const [clientId,       setClientId]       = useState('')
  const [documentDate,   setDocumentDate]   = useState(today)
  const [documentNumber, setDocumentNumber] = useState('')
  const [type,           setType]           = useState<InvoiceType>('invoice')
  const [currency,       setCurrency]       = useState('EUR')
  const [totalAmount,    setTotalAmount]    = useState('')
  const [vatAmount,      setVatAmount]      = useState('')
  const [headerText,     setHeaderText]     = useState('')
  const [attachments,    setAttachments]    = useState<AttachmentItem[]>([])
  const [error,          setError]          = useState('')

  const totalNum = useMemo(() => Number(totalAmount.replace(',', '.')), [totalAmount])
  const vatNum   = useMemo(() => Number(vatAmount.replace(',', '.')),   [vatAmount])
  const canSubmit = !!clientId && !!documentDate && !!documentNumber.trim()
    && isFinite(totalNum) && totalAmount !== ''
    && isFinite(vatNum)   && vatAmount   !== ''

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!canSubmit) {
      setError('Compila tutti i campi obbligatori.')
      return
    }
    startTransition(async () => {
      const res = await createInvoice({
        id:             invoiceId,
        clientId,
        documentDate,
        documentNumber: documentNumber.trim(),
        type,
        currency,
        totalAmount:    totalNum,
        vatAmount:      vatNum,
        headerText:     headerText.trim() || null,
        attachments,
      })
      if (res.ok) {
        router.push(`/clients/invoices/${res.id}`)
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

      <Field icon={Building2} label="Cliente fatturazione *">
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          disabled={isPending}
          className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Seleziona cliente fatturazione…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field icon={Calendar} label="Data documento *">
          <input
            type="date"
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Field>
        <Field icon={Hash} label="Numero documento *">
          <input
            type="text"
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value)}
            placeholder="es. 2026/0042"
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Field>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipologia *</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="invoice-type"
              checked={type === 'invoice'}
              onChange={() => setType('invoice')}
              disabled={isPending}
              className="h-4 w-4 border-gray-300 text-blue-600"
            />
            Fattura
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="invoice-type"
              checked={type === 'credit_note'}
              onChange={() => setType('credit_note')}
              disabled={isPending}
              className="h-4 w-4 border-gray-300 text-blue-600"
            />
            Nota credito
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field icon={Euro} label="Divisa *">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field icon={Euro} label="Importo Totale *">
          <input
            type="number"
            step={0.01}
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="0.00"
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                       [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
        </Field>
        <Field icon={Percent} label="IVA *">
          <input
            type="number"
            step={0.01}
            value={vatAmount}
            onChange={(e) => setVatAmount(e.target.value)}
            placeholder="0.00"
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                       [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <p className="mt-1 text-xs text-gray-400">Importo IVA — 0 se esente.</p>
        </Field>
      </div>

      <Field icon={FileText} label="Testo testata">
        <textarea
          value={headerText}
          onChange={(e) => setHeaderText(e.target.value)}
          rows={3}
          disabled={isPending}
          placeholder="Note varie…"
          className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </Field>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Allegati <span className="text-gray-400 font-normal">(facoltativi)</span>
        </label>
        <OrderAttachmentsList
          purchaseOrderId={invoiceId}
          kind="invoice"
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
          onClick={() => router.push('/clients/invoices')}
          disabled={isPending}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Annulla
        </button>
        <button
          type="submit"
          disabled={!canSubmit || isPending}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <FileText className="inline h-4 w-4 mr-2 -mt-0.5" />
          {isPending ? 'Creazione…' : 'Crea documento'}
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
