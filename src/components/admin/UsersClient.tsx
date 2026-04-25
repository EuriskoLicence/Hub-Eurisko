'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, X, CheckCircle2, XCircle, KeyRound, Eye, EyeOff, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createUser, updateUser, resetUserPassword } from '@/app/(dashboard)/admin/actions'
import type { UserRow, RoleOption } from '@/app/(dashboard)/admin/actions'

type Props = { users: UserRow[]; roles: RoleOption[] }

export function UsersClient({ users, roles }: Props) {
  const router = useRouter()
  const [showCreate, setShowCreate]         = useState(false)
  const [editUser,   setEditUser]           = useState<UserRow | null>(null)
  const [resetSuccessId, setResetSuccessId] = useState<string | null>(null)
  const [resetErrorId,   setResetErrorId]   = useState<string | null>(null)
  const [resettingId,    setResettingId]    = useState<string | null>(null)
  const [, startResetTransition]            = useTransition()

  function handleResetPassword(userId: string) {
    if (!window.confirm('Reimpostare la password di questo utente? Riceverà una nuova password temporanea via email.')) return
    setResettingId(userId)
    setResetSuccessId(null)
    setResetErrorId(null)
    startResetTransition(async () => {
      const res = await resetUserPassword(userId)
      setResettingId(null)
      if (res.ok) {
        setResetSuccessId(userId)
        setTimeout(() => setResetSuccessId(null), 2000)
        router.refresh()
      } else {
        setResetErrorId(userId)
        setTimeout(() => setResetErrorId(null), 3000)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nuovo utente
        </button>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Utente</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Ruolo</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Attivo</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{u.lastName} {u.firstName}</span>
                    {u.excludeFromTimesheet && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        excl. consunt.
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">{u.email}</div>
                  {/* Password temporanea — visibile solo finché l'utente non la cambia */}
                  {u.mustChangePassword && u.tempPassword && (
                    <TempPasswordBadge password={u.tempPassword} />
                  )}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-gray-600">
                  {u.roleName ?? <span className="text-gray-300 italic">Nessun ruolo</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  {u.active
                    ? <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                    : <XCircle className="h-4 w-4 text-gray-300 inline" />
                  }
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditUser(u)}
                      className="rounded p-1 text-gray-400 hover:text-blue-600"
                      title="Modifica utente"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResetPassword(u.id)}
                      disabled={resettingId === u.id}
                      className={cn(
                        'rounded p-1',
                        resetSuccessId === u.id ? 'text-green-500' :
                        resetErrorId   === u.id ? 'text-red-500'   :
                        'text-gray-400 hover:text-amber-600',
                        resettingId === u.id && 'opacity-50 cursor-not-allowed',
                      )}
                      title="Reimposta password"
                    >
                      {resetSuccessId === u.id
                        ? <CheckCircle2 className="h-3.5 w-3.5" />
                        : <KeyRound className="h-3.5 w-3.5" />
                      }
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <UserModal
          roles={roles}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editUser && (
        <UserModal
          user={editUser}
          roles={roles}
          onClose={() => setEditUser(null)}
        />
      )}
    </div>
  )
}

// ─── Componente badge password temporanea ─────────────────────────────────────

function TempPasswordBadge({ password }: { password: string }) {
  const [visible, setVisible] = useState(false)
  const [copied,  setCopied]  = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2 py-1">
      <KeyRound className="h-3 w-3 text-amber-500 shrink-0" />
      <span className="text-xs text-amber-700 font-medium">
        {visible ? password : '••••••••••••'}
      </span>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="text-amber-400 hover:text-amber-700 ml-0.5"
        title={visible ? 'Nascondi' : 'Mostra password'}
      >
        {visible
          ? <EyeOff className="h-3 w-3" />
          : <Eye    className="h-3 w-3" />
        }
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="text-amber-400 hover:text-amber-700"
        title="Copia password"
      >
        {copied
          ? <Check  className="h-3 w-3 text-green-500" />
          : <Copy   className="h-3 w-3" />
        }
      </button>
    </div>
  )
}

// ─── Modal creazione / modifica utente ────────────────────────────────────────

function UserModal({
  user, roles, onClose,
}: {
  user?:   UserRow
  roles:   RoleOption[]
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    firstName:            user?.firstName            ?? '',
    lastName:             user?.lastName             ?? '',
    email:                user?.email                ?? '',
    roleId:               user?.roleId               ?? '',
    active:               user?.active               ?? true,
    tariffaKm:            user?.tariffaKm            ?? '',
    excludeFromTimesheet: user?.excludeFromTimesheet ?? false,
    partTime:             user?.partTime             ?? false,
  })

  function set(k: keyof typeof form, v: any) { setForm((p) => ({ ...p, [k]: v })); setError('') }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      let res
      if (user) {
        res = await updateUser(user.id, {
          firstName:            form.firstName,
          lastName:             form.lastName,
          email:                form.email,
          roleId:               form.roleId || null,
          active:               form.active,
          tariffaKm:            form.tariffaKm || null,
          excludeFromTimesheet: form.excludeFromTimesheet,
          partTime:             form.partTime,
        })
      } else {
        res = await createUser({
          firstName: form.firstName,
          lastName:  form.lastName,
          email:     form.email,
          roleId:    form.roleId || null,
        })
      }
      if (res.ok) { onClose(); router.refresh() }
      else setError(res.error)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {user ? 'Modifica utente' : 'Nuovo utente'}
          </h2>
          <button type="button" onClick={onClose}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome *" value={form.firstName} onChange={(v) => set('firstName', v)} />
            <Field label="Cognome *" value={form.lastName}  onChange={(v) => set('lastName',  v)} />
          </div>
          <Field label="Email *" type="email" value={form.email} onChange={(v) => set('email', v)} />
          {!user && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
              Una password temporanea verrà generata automaticamente e inviata via email all'utente.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Ruolo</label>
            <select
              value={form.roleId}
              onChange={(e) => set('roleId', e.target.value)}
              disabled={isPending}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">Nessun ruolo</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Tariffa km <span className="text-gray-400 font-normal">(€/km, facoltativa)</span>
            </label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={form.tariffaKm}
              onChange={(e) => set('tariffaKm', e.target.value)}
              placeholder="es. 0.4200"
              disabled={isPending}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-gray-400">Usata per il calcolo automatico delle spese chilometriche.</p>
          </div>

          {user && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input id="u-active" type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600" disabled={isPending} />
                <label htmlFor="u-active" className="text-sm text-gray-700">Attivo</label>
              </div>
              <div className="flex items-center gap-2">
                <input id="u-excl-ts" type="checkbox" checked={form.excludeFromTimesheet} onChange={(e) => set('excludeFromTimesheet', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-amber-500" disabled={isPending} />
                <label htmlFor="u-excl-ts" className="text-sm text-gray-700">
                  Escludi da obbligo consuntivazione
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input id="u-part-time" type="checkbox" checked={form.partTime} onChange={(e) => set('partTime', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-500" disabled={isPending} />
                <label htmlFor="u-part-time" className="text-sm text-gray-700">
                  Part time
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={isPending}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Annulla
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {isPending ? 'Salvataggio…' : user ? 'Salva' : 'Crea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  )
}
