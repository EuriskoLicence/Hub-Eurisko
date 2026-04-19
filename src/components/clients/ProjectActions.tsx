'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X } from 'lucide-react'
import { updateProject } from '@/app/(dashboard)/clients/actions'
import type { ProjectDetail, UserOption } from '@/app/(dashboard)/clients/actions'

type Props = {
  project:     ProjectDetail
  userOptions: UserOption[]
}

export function ProjectActions({ project, userOptions }: Props) {
  const router = useRouter()
  const [open,            setOpen]            = useState(false)
  const [name,            setName]            = useState(project.name)
  const [active,          setActive]          = useState(project.active)
  const [responsibleId,   setResponsibleId]   = useState(project.responsibleUserId ?? '')
  const [error,           setError]           = useState('')
  const [isPending,       startTransition]    = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Il nome è obbligatorio.'); return }
    setError('')
    startTransition(async () => {
      const res = await updateProject(project.id, {
        name,
        active,
        responsibleUserId: responsibleId || null,
      })
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
              <h2 className="text-base font-semibold text-gray-900">Modifica progetto</h2>
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome progetto</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError('') }}
                  disabled={isPending}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             disabled:opacity-50"
                />
              </div>

              {userOptions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Responsabile</label>
                  <select
                    value={responsibleId}
                    onChange={(e) => setResponsibleId(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                               disabled:opacity-50"
                  >
                    <option value="">Nessun responsabile</option>
                    {userOptions.map((u) => (
                      <option key={u.id} value={u.id}>{u.fullName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  id="project-active"
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  disabled={isPending}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <label htmlFor="project-active" className="text-sm text-gray-700">Attivo</label>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setName(project.name); setActive(project.active); setError('') }}
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
