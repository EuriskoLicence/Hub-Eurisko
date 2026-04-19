'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createExpenseReport } from '../actions'

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

function getDefaultYearMonth() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

// Genera opzioni anno/mese: ultimi 12 mesi + corrente
function getMonthOptions() {
  const options: { year: number; month: number; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 13; i++) {
    let m = now.getMonth() + 1 - i
    let y = now.getFullYear()
    while (m <= 0) { m += 12; y-- }
    options.push({ year: y, month: m, label: `${IT_MONTHS[m - 1]} ${y}` })
  }
  return options
}

export default function NewExpensePage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const def     = getDefaultYearMonth()
  const options = getMonthOptions()

  const [selected, setSelected] = useState(`${def.year}-${def.month}`)
  const [title,    setTitle]    = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Il titolo è obbligatorio.'); return }
    setError('')

    const [y, m] = selected.split('-').map(Number)
    startTransition(async () => {
      const res = await createExpenseReport({ year: y, month: m, title: title.trim() })
      if (res.ok) {
        router.push(`/expenses/${res.id}`)
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <nav className="text-xs text-gray-400 mb-1">
          <a href="/expenses" className="hover:text-gray-600">Note spese</a> / Nuova
        </nav>
        <h1 className="text-xl font-bold text-gray-900">Nuova nota spese</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Periodo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Periodo</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={isPending}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {options.map((o) => (
                <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Titolo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Titolo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError('') }}
              disabled={isPending}
              placeholder="es. Trasferta Milano — Aprile 2025"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900
                         placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                         focus:border-transparent disabled:opacity-50"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={isPending}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium
                         text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isPending || !title.trim()}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white
                         hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Creazione…' : 'Crea nota spese'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
