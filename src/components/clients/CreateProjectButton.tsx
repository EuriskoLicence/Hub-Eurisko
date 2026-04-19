'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { createProject, getNextProjectCode } from '@/app/(dashboard)/clients/actions'

type Props = { clientId: string }

export function CreateProjectButton({ clientId }: Props) {
  const router = useRouter()
  const [open,      setOpen]      = useState(false)
  const [name,      setName]      = useState('')
  const [nextCode,  setNextCode]  = useState('')
  const [error,     setError]     = useState('')
  const [isPending, startTransition] = useTransition()
  const [isLoadingCode, startLoadCode] = useTransition()

  function handleOpen() {
    setOpen(true)
    startLoadCode(async () => {
      const code = await getNextProjectCode(clientId)
      setNextCode(code)
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Il nome è obbligatorio.'); return }
    setError('')
    startTransition(async () => {
      const res = await createProject(clientId, { name })
      if (res.ok) {
        setOpen(false)
        setName('')
        setNextCode('')
        router.push(`/clients/${clientId}/projects/${res.id}`)
      } else {
        setError(res.error)
      }
    })
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
        Nuovo progetto
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Nuovo progetto</h2>
              <button type="button" onClick={() => { setOpen(false); setName(''); setNextCode(''); setError('') }}>
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
                  Nome progetto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError('') }}
                  placeholder="es. Progetto CRM 2025"
                  autoFocus
                  disabled={isPending}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Codice progetto</label>
                <input
                  type="text"
                  value={isLoadingCode ? '…' : nextCode}
                  readOnly
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-mono text-gray-500 cursor-default"
                />
                <p className="text-xs text-gray-400 mt-1">Assegnato automaticamente dal sistema.</p>
              </div>
              <p className="text-xs text-gray-500">
                Sarai impostato come responsabile del progetto. Potrai modificarlo in seguito.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setName(''); setNextCode(''); setError('') }}
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium
                             text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isPending || !name.trim()}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white
                             hover:bg-blue-700 disabled:opacity-50"
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
