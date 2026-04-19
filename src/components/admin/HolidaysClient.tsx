'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Plus, Pencil, Trash2, X, RefreshCw } from 'lucide-react'
import { createHoliday, updateHoliday, deleteHoliday } from '@/app/(dashboard)/admin/actions'
import type { HolidayRow } from '@/app/(dashboard)/admin/actions'

type Props = { holidays: HolidayRow[]; currentYear: number; years: number[] }

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

export function HolidaysClient({ holidays, currentYear, years }: Props) {
  const router    = useRouter()
  const pathname  = usePathname()
  const [showCreate, setShowCreate] = useState(false)
  const [editHoliday, setEditHoliday] = useState<HolidayRow | null>(null)

  function handleYearChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(`${pathname}?year=${e.target.value}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <select
          value={currentYear}
          onChange={handleYearChange}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          Aggiungi festività
        </button>
      </div>

      {holidays.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
          Nessuna festività per il {currentYear}.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 w-24">Ricorrente</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {holidays.map((h) => {
                const d     = new Date(h.date + 'T00:00:00Z')
                const label = `${d.getUTCDate()} ${IT_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
                return (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 tabular-nums text-gray-700">{label}</td>
                    <td className="px-4 py-3 text-gray-900">{h.name}</td>
                    <td className="px-4 py-3 text-center">
                      {h.isRecurring && <RefreshCw className="h-3.5 w-3.5 text-blue-400 inline" aria-label="Ricorrente" />}
                    </td>
                    <td className="px-2 py-3 flex items-center gap-1">
                      <button type="button" onClick={() => setEditHoliday(h)}
                        className="rounded p-1 text-gray-400 hover:text-blue-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <DeleteButton id={h.id} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {(showCreate || editHoliday) && (
        <HolidayModal
          holiday={editHoliday ?? undefined}
          defaultYear={currentYear}
          onClose={() => { setShowCreate(false); setEditHoliday(null) }}
        />
      )}
    </div>
  )
}

function DeleteButton({ id }: { id: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)

  if (confirm) {
    return (
      <span className="flex items-center gap-1">
        <button type="button" onClick={() => setConfirm(false)}
          className="text-xs text-gray-500 hover:text-gray-700">Annulla</button>
        <button type="button" disabled={isPending}
          onClick={() => startTransition(async () => { await deleteHoliday(id); router.refresh() })}
          className="text-xs text-red-600 font-medium hover:text-red-700 disabled:opacity-50">
          Sì, elimina
        </button>
      </span>
    )
  }

  return (
    <button type="button" onClick={() => setConfirm(true)}
      className="rounded p-1 text-gray-400 hover:text-red-500">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}

function HolidayModal({ holiday, defaultYear, onClose }: {
  holiday?: HolidayRow; defaultYear: number; onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [date,      setDate]      = useState(holiday?.date ?? `${defaultYear}-01-01`)
  const [name,      setName]      = useState(holiday?.name ?? '')
  const [recurring, setRecurring] = useState(holiday?.isRecurring ?? false)
  const [error,     setError]     = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = holiday
        ? await updateHoliday(holiday.id, { name, isRecurring: recurring })
        : await createHoliday({ date, name, isRecurring: recurring })
      if (res.ok) { onClose(); router.refresh() }
      else setError((res as any).error)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {holiday ? 'Modifica festività' : 'Aggiungi festività'}
          </h2>
          <button type="button" onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

          {!holiday && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Data *</label>
              <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setError('') }} required
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome festività *</label>
            <input type="text" value={name} onChange={(e) => { setName(e.target.value); setError('') }} required
              placeholder="es. Ferragosto"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>

          <div className="flex items-center gap-2">
            <input id="recurring" type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-red-600" />
            <label htmlFor="recurring" className="text-sm text-gray-700">
              Ricorrente ogni anno (solo MM-GG viene usato)
            </label>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={isPending}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Annulla
            </button>
            <button type="submit" disabled={isPending || !name.trim()}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {isPending ? 'Salvataggio…' : holiday ? 'Salva' : 'Aggiungi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
