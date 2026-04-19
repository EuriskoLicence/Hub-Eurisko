'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Tag, Users, UserPlus, UserMinus, Pencil, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateEngagement, assignUserToEngagement, removeUserFromEngagement } from '@/app/(dashboard)/clients/actions'
import type { EngagementDetail, UserOption } from '@/app/(dashboard)/clients/actions'

type Props = {
  engagement:  EngagementDetail
  projectId:   string
  clientId:    string
  canManage:   boolean
  userOptions: UserOption[]
}

export function EngagementCard({ engagement, projectId, clientId, canManage, userOptions }: Props) {
  const router = useRouter()
  const [expanded,    setExpanded]    = useState(false)
  const [editOpen,    setEditOpen]    = useState(false)
  const [name,        setName]        = useState(engagement.name)
  const [active,      setActive]      = useState(engagement.active)
  const [error,       setError]       = useState('')
  const [isPending,   startTransition] = useTransition()
  const [addUserId,   setAddUserId]   = useState('')

  function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Il nome è obbligatorio.'); return }
    setError('')
    startTransition(async () => {
      const res = await updateEngagement(engagement.id, { name, active })
      if (res.ok) { setEditOpen(false); router.refresh() }
      else setError(res.error)
    })
  }

  function handleAssign() {
    if (!addUserId) return
    startTransition(async () => {
      const res = await assignUserToEngagement(engagement.id, addUserId)
      if (res.ok) { setAddUserId(''); router.refresh() }
      else setError(res.error)
    })
  }

  function handleRemoveUser(userId: string) {
    startTransition(async () => {
      const res = await removeUserFromEngagement(engagement.id, userId)
      if (res.ok) router.refresh()
      else setError(res.error)
    })
  }

  // Available users to add (not already assigned)
  const assignedIds    = new Set(engagement.assignedUsers.map((u) => u.userId))
  const availableUsers = userOptions.filter((u) => !assignedIds.has(u.id))

  return (
    <div className={cn(
      'bg-white rounded-xl border overflow-hidden',
      engagement.active ? 'border-gray-200' : 'border-gray-100 opacity-70',
    )}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg shrink-0',
          engagement.active ? 'bg-purple-50' : 'bg-gray-100',
        )}>
          <Tag className={cn('h-3.5 w-3.5', engagement.active ? 'text-purple-500' : 'text-gray-400')} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('font-medium text-sm truncate', !engagement.active && 'line-through text-gray-400')}>
              {engagement.name}
            </span>
            <span className="text-xs font-mono text-gray-400">{engagement.code}</span>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
            <span>{engagement.engagementTypeName}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {engagement.assignedUsers.length} assegnati
            </span>
          </div>
        </div>
        {!engagement.active && (
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 shrink-0">Inattiva</span>
        )}
        <ChevronDown className={cn('h-4 w-4 text-gray-400 shrink-0 transition-transform', expanded && 'rotate-180')} />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Assigned users */}
          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-2">Utenti assegnati</h4>
            {engagement.assignedUsers.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Nessun utente assegnato.</p>
            ) : (
              <div className="space-y-1">
                {engagement.assignedUsers.map((u) => (
                  <div key={u.userId} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5">
                    <div>
                      <span className="text-sm text-gray-800">{u.fullName}</span>
                      <span className="text-xs text-gray-400 ml-2">{u.email}</span>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleRemoveUser(u.userId)}
                        disabled={isPending}
                        className="rounded p-0.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                        title="Rimuovi"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add user */}
          {canManage && availableUsers.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                disabled={isPending}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              >
                <option value="">Aggiungi utente…</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAssign}
                disabled={isPending || !addUserId}
                className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium
                           text-white hover:bg-purple-700 disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Aggiungi
              </button>
            </div>
          )}

          {/* Edit engagement */}
          {canManage && (
            <div className="pt-1 border-t border-gray-100">
              {!editOpen ? (
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
                >
                  <Pencil className="h-3 w-3" />
                  Modifica commessa
                </button>
              ) : (
                <form onSubmit={handleEdit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setError('') }}
                      disabled={isPending}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id={`eng-active-${engagement.id}`}
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                      disabled={isPending}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600"
                    />
                    <label htmlFor={`eng-active-${engagement.id}`} className="text-xs text-gray-700">Attiva</label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setEditOpen(false); setName(engagement.name); setActive(engagement.active); setError('') }}
                      disabled={isPending}
                      className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Annulla
                    </button>
                    <button
                      type="submit"
                      disabled={isPending || !name.trim()}
                      className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      {isPending ? 'Salvataggio…' : 'Salva'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
