'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { createEngagement, getNextEngagementCode } from '@/app/(dashboard)/clients/actions'
import type { EngagementTypeOption } from '@/app/(dashboard)/clients/actions'

type Props = {
  projectId:       string
  engagementTypes: EngagementTypeOption[]
}

export function CreateEngagementButton({ projectId, engagementTypes }: Props) {
  const router = useRouter()
  const [open,            setOpen]            = useState(false)
  const [name,            setName]            = useState('')
  const [nextCode,        setNextCode]        = useState('')
  const [engTypeId,       setEngTypeId]       = useState(engagementTypes[0]?.id ?? '')
  const [totalHours,      setTotalHours]      = useState('999999')
  const [validUntil,      setValidUntil]      = useState('2999-12-31')
  const [error,           setError]           = useState('')
  const [isPending,       startTransition]    = useTransition()
  const [isLoadingCode,   startLoadCode]      = useTransition()

  function handleOpen() {
    setOpen(true)
    startLoadCode(async () => {
      const code = await getNextEngagementCode(projectId)
      setNextCode(code)
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Il nome è obbligatorio.'); return }
    if (!engTypeId)   { setError('La tipologia è obbligatoria.'); return }
    setError('')
    startTransition(async () => {
      const res = await createEngagement(projectId, {
        name,
        engagementTypeId: engTypeId,
        totalHours: parseInt(totalHours) || 999999,
        validUntil: validUntil || '2999-12-31',
      })
      if (res.ok) {
        setOpen(false)
        setName('')
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  function close() {
    setOpen(false)
    setName('')
    setNextCode('')
    setError('')
    setEngTypeId(engagementTypes[0]?.id ?? '')
    setTotalHours('999999')
    setValidUntil('2999-12-31')
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5
                   text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Nuova commessa
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Nuova commessa</h2>
              <button type="button" onClick={close}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nome commessa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError('') }}
                  placeholder="es. Fase 1 - Analisi"
                  autoFocus
                  disabled={isPending}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                             disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Codice commessa</label>
                <input
                  type="text"
                  value={isLoadingCode ? '…' : nextCode}
                  readOnly
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-mono text-gray-500 cursor-default"
                />
                <p className="text-xs text-gray-400 mt-1">Assegnato automaticamente dal sistema.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tipologia <span className="text-red-500">*</span>
                </label>
                <select
                  value={engTypeId}
                  onChange={(e) => setEngTypeId(e.target.value)}
                  disabled={isPending}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                             disabled:opacity-50"
                >
                  <option value="">Seleziona tipologia…</option>
                  {engagementTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Totale ore <span className="text-gray-400 font-normal">(budget ore commessa)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={totalHours}
                  onChange={(e) => { setTotalHours(e.target.value); setError('') }}
                  disabled={isPending}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                             disabled:opacity-50
                             [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <p className="text-xs text-gray-400 mt-1">Default 999.999 (illimitato).</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Data fine validità
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => { setValidUntil(e.target.value || '2999-12-31'); setError('') }}
                  disabled={isPending}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                             disabled:opacity-50"
                />
                <p className="text-xs text-gray-400 mt-1">Default 31/12/2999 (nessuna scadenza).</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={close}
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium
                             text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isPending || !name.trim() || !engTypeId}
                  className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white
                             hover:bg-purple-700 disabled:opacity-50"
                >
                  {isPending ? 'Creazione…' : 'Crea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
