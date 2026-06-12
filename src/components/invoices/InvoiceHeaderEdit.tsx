'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, AlertCircle, Trash2 } from 'lucide-react'
import { updateInvoice, deleteInvoice, type InvoiceType } from '@/app/(dashboard)/clients/invoices/actions'

type ClientOption = { id: string; name: string; code: string }

type Props = {
  invoiceId:      string
  clientId:       string
  documentDate:   string
  documentNumber: string
  type:           InvoiceType
  currency:       string
  totalAmount:    string
  vatAmount:      string
  headerText:     string | null
  hasLines:       boolean
  clients:        ClientOption[]
  canManage:      boolean
}

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const

export function InvoiceHeaderEdit({
  invoiceId, clientId, documentDate, documentNumber, type, currency,
  totalAmount, vatAmount, headerText, hasLines, clients, canManage,
}: Props) {
  const router = useRouter()
  const [editing,   setEditing]   = useState(false)
  const [isPending, startTransition] = useTransition()

  const [cli,  setCli]  = useState(clientId)
  const [dt,   setDt]   = useState(documentDate)
  const [num,  setNum]  = useState(documentNumber)
  const [tp,   setTp]   = useState<InvoiceType>(type)
  const [cur,  setCur]  = useState(currency)
  const [tot,  setTot]  = useState(totalAmount)
  const [vat,  setVat]  = useState(vatAmount)
  const [txt,  setTxt]  = useState(headerText ?? '')
  const [error, setError] = useState('')

  function reset() {
    setCli(clientId); setDt(documentDate); setNum(documentNumber); setTp(type)
    setCur(currency); setTot(totalAmount); setVat(vatAmount); setTxt(headerText ?? '')
    setError('')
  }

  function handleSave() {
    setError('')
    const totNum = Number(String(tot).replace(',', '.'))
    const vatNum = Number(String(vat).replace(',', '.'))
    if (!isFinite(totNum)) { setError('Importo Totale non valido.'); return }
    if (!isFinite(vatNum)) { setError('IVA non valida.'); return }

    const totalsChanging = Math.abs(totNum - Number(totalAmount)) > 0.001
                        || Math.abs(vatNum - Number(vatAmount))   > 0.001
    if (totalsChanging && hasLines) {
      const ok = window.confirm(
        'La fattura ha già delle posizioni. Modificando Totale o IVA la somma delle posizioni potrebbe non quadrare più: dovrai riallineare le posizioni. Procedere?'
      )
      if (!ok) return
    }

    startTransition(async () => {
      const res = await updateInvoice(invoiceId, {
        clientId:       cli,
        documentDate:   dt,
        documentNumber: num.trim(),
        type:           tp,
        currency:       cur,
        totalAmount:    totNum,
        vatAmount:      vatNum,
        headerText:     txt.trim() || null,
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
    if (!window.confirm('La fattura e tutte le sue posizioni/allegati verranno eliminati definitivamente. Procedere?')) return
    startTransition(async () => {
      const res = await deleteInvoice(invoiceId)
      if (res.ok) {
        router.push('/clients/invoices')
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  if (!canManage || !editing) {
    return canManage ? (
      <div className="flex gap-2 flex-wrap">
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
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-3 w-3" />
          Elimina documento
        </button>
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700">{error}</div>}
      </div>
    ) : null
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-3">
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
          <label className="block text-xs font-medium text-gray-600 mb-1">Cliente</label>
          <select
            value={cli}
            onChange={(e) => setCli(e.target.value)}
            disabled={isPending || hasLines}
            title={hasLines ? 'Per cambiare cliente elimina prima le posizioni' : undefined}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Data documento</label>
          <input
            type="date"
            value={dt}
            onChange={(e) => setDt(e.target.value)}
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Numero documento</label>
          <input
            type="text"
            value={num}
            onChange={(e) => setNum(e.target.value)}
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipologia</label>
          <select
            value={tp}
            onChange={(e) => setTp(e.target.value as InvoiceType)}
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="invoice">Fattura</option>
            <option value="credit_note">Nota credito</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Divisa</label>
          <select
            value={cur}
            onChange={(e) => setCur(e.target.value)}
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Importo Totale</label>
            <input
              type="number"
              step={0.01}
              value={tot}
              onChange={(e) => setTot(e.target.value)}
              disabled={isPending}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                         [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">IVA</label>
            <input
              type="number"
              step={0.01}
              value={vat}
              onChange={(e) => setVat(e.target.value)}
              disabled={isPending}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                         [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Testo testata</label>
        <textarea
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          rows={2}
          disabled={isPending}
          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? 'Salvataggio…' : 'Salva testata'}
        </button>
      </div>
    </div>
  )
}
