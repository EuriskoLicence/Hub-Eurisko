'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, MoreVertical } from 'lucide-react'
import { updateClient } from '@/app/(dashboard)/clients/actions'
import type { ClientDetail } from '@/app/(dashboard)/clients/actions'

type Props = { client: ClientDetail }

export function ClientActions({ client }: Props) {
  const router = useRouter()
  const [open,      setOpen]      = useState(false)
  const [name,      setName]      = useState(client.name)
  const [active,    setActive]    = useState(client.active)
  const [error,     setError]     = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Il nome è obbligatorio.'); return }
    setError('')
    startTransition(async () => {
      const res = await updateClient(client.id, { name, active })
      if (res.ok) {
        setOpen(false)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm
                   font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Pencil className="h-4 w-4" />
        Modifica
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Modifica cliente</h2>
              <button type="button" onClick={() => { setOpen(false); setError('') }}>
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome cliente</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError('') }}
                  disabled={isPending}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                             disabled:opacity-50"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="client-active"
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  disabled={isPending}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                />
                <label htmlFor="client-active" className="text-sm text-gray-700">Attivo</label>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setName(client.name); setActive(client.active); setError('') }}
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium
                             text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isPending || !name.trim()}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                             hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isPending ? 'Salvataggio…' : 'Salva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
