'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Tag, Users, UserPlus, UserMinus, Pencil, ChevronDown, X, Clock, CalendarX2, CheckCircle2, Activity, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateEngagement, assignUserToEngagement, removeUserFromEngagement, setEngagementUserExtraOnly } from '@/app/(dashboard)/clients/actions'
import type { EngagementDetail, UserOption, EngagementStatusOption } from '@/app/(dashboard)/clients/actions'

type Props = {
  engagement:         EngagementDetail
  projectId:          string
  clientId:           string
  canManage:          boolean
  userOptions:        UserOption[]
  engagementStatuses: EngagementStatusOption[]
}

export function EngagementCard({ engagement, projectId, clientId, canManage, userOptions, engagementStatuses }: Props) {
  const router = useRouter()
  const [expanded,    setExpanded]    = useState(false)
  const [editOpen,    setEditOpen]    = useState(false)
  const [name,        setName]        = useState(engagement.name)
  const [totalHours,  setTotalHours]  = useState(String(engagement.totalHours))
  const [validUntil,  setValidUntil]  = useState(engagement.validUntil)
  const [conclusa,    setConclusa]    = useState(engagement.conclusa)
  const [statusId,    setStatusId]    = useState<string>(engagement.statusId ?? '')
  const [error,       setError]       = useState('')
  const [isPending,   startTransition] = useTransition()
  const [addUserId,   setAddUserId]   = useState('')

  function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Il nome è obbligatorio.'); return }
    setError('')
    startTransition(async () => {
      const res = await updateEngagement(engagement.id, {
        name,
        totalHours: parseInt(totalHours) || 999999,
        validUntil: validUntil || '2999-12-31',
        conclusa,
        statusId: statusId || null,
      })
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

  function handleToggleExtraOnly(userId: string, newValue: boolean) {
    startTransition(async () => {
      const res = await setEngagementUserExtraOnly(engagement.id, userId, newValue)
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
          <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5 flex-wrap">
            <span>{engagement.engagementTypeName}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {engagement.assignedUsers.length} assegnati
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {engagement.totalHours.toLocaleString('it-IT')}h
            </span>
            {engagement.validUntil !== '2999-12-31' && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <CalendarX2 className="h-3 w-3" />
                  {new Date(engagement.validUntil + 'T00:00:00').toLocaleDateString('it-IT')}
                </span>
              </>
            )}
          </div>
        </div>
        {engagement.statusCode && (
          <span
            className="text-xs font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5 shrink-0"
            title={engagement.statusDescription ?? undefined}
          >
            {engagement.statusCode}
          </span>
        )}
        {engagement.conclusa && (
          <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5 shrink-0">
            Conclusa
          </span>
        )}
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
                  <div key={u.userId} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-gray-800">{u.fullName}</span>
                        {u.extraOnly && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-medium text-teal-700">
                            <Timer className="h-3 w-3" />
                            Solo extra
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{u.email}</span>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-2 shrink-0">
                        <label
                          className={cn(
                            'flex items-center gap-1.5 cursor-pointer select-none text-[11px]',
                            u.extraOnly ? 'text-teal-700' : 'text-gray-400 hover:text-gray-600',
                          )}
                          title={u.extraOnly
                            ? "L'utente vedrà questa commessa SOLO nel timesheet extra"
                            : "L'utente vede questa commessa sia in ordinario sia in extra"}
                        >
                          <input
                            type="checkbox"
                            checked={u.extraOnly}
                            onChange={(e) => handleToggleExtraOnly(u.userId, e.target.checked)}
                            disabled={isPending}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          Solo extra
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveUser(u.userId)}
                          disabled={isPending}
                          className="rounded p-0.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="Rimuovi"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      </div>
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
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Totale ore
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={totalHours}
                      onChange={(e) => { setTotalHours(e.target.value); setError('') }}
                      disabled={isPending}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50
                                 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Data fine validità
                    </label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => { setValidUntil(e.target.value || '2999-12-31'); setError('') }}
                      disabled={isPending}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    />
                    <p className="text-xs text-gray-400 mt-1">Default 31/12/2999 (nessuna scadenza).</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Stato <span className="text-gray-400 font-normal">(facoltativo)</span>
                    </label>
                    <select
                      value={statusId}
                      onChange={(e) => setStatusId(e.target.value)}
                      disabled={isPending}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-base md:text-sm
                                 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    >
                      <option value="">— Nessuno —</option>
                      {engagementStatuses.map((s) => (
                        <option key={s.id} value={s.id}>{s.code} — {s.description}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id={`eng-conclusa-${engagement.id}`}
                      type="checkbox"
                      checked={conclusa}
                      onChange={(e) => setConclusa(e.target.checked)}
                      disabled={isPending}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-500"
                    />
                    <label htmlFor={`eng-conclusa-${engagement.id}`} className="text-sm text-gray-700">
                      Conclusa
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditOpen(false)
                        setName(engagement.name)
                        setTotalHours(String(engagement.totalHours))
                        setValidUntil(engagement.validUntil)
                        setConclusa(engagement.conclusa)
                        setStatusId(engagement.statusId ?? '')
                        setError('')
                      }}
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
