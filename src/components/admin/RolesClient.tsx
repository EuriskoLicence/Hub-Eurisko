'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, X, ChevronDown, Shield, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createProfile, updateProfile, createRole, updateRole } from '@/app/(dashboard)/admin/actions'
import { SECTIONS, SECTIONS_META } from '@/lib/permissions/sections'
import type { SectionCode } from '@/lib/permissions/sections'
import type { ProfileRow, RoleRow } from '@/app/(dashboard)/admin/actions'

type Props = { roles: RoleRow[]; profiles: ProfileRow[] }

export function RolesClient({ roles, profiles }: Props) {
  const [tab, setTab] = useState<'profiles' | 'roles'>('profiles')

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {(['profiles', 'roles'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {t === 'profiles' ? 'Profili' : 'Ruoli'}
          </button>
        ))}
      </div>

      {tab === 'profiles' && <ProfilesTab profiles={profiles} />}
      {tab === 'roles'    && <RolesTab    roles={roles} profiles={profiles} />}
    </div>
  )
}

// ─── Profili ──────────────────────────────────────────────────────────────────

function ProfilesTab({ profiles }: { profiles: ProfileRow[] }) {
  const [showCreate, setShowCreate] = useState(false)
  const [editProfile, setEditProfile] = useState<ProfileRow | null>(null)

  // Group sections by area
  const areas = Array.from(new Set(Object.values(SECTIONS_META).map((m) => m.area)))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">I profili raggruppano sezioni di autorizzazione.</p>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuovo profilo
        </button>
      </div>

      {profiles.map((p) => (
        <ProfileCard key={p.id} profile={p} onEdit={() => setEditProfile(p)} />
      ))}

      {(showCreate || editProfile) && (
        <ProfileModal
          profile={editProfile ?? undefined}
          areas={areas}
          onClose={() => { setShowCreate(false); setEditProfile(null) }}
        />
      )}
    </div>
  )
}

function ProfileCard({ profile, onEdit }: { profile: ProfileRow; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const areas = Array.from(new Set(profile.sections.map((s) => SECTIONS_META[s]?.area ?? 'Altro')))

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div role="button" tabIndex={0} onClick={() => setExpanded((p) => !p)}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left cursor-pointer">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 shrink-0">
          <Shield className="h-3.5 w-3.5 text-purple-500" />
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-900 text-sm">{profile.name}</div>
          <div className="text-xs text-gray-500">{profile.sections.length} sezioni · {areas.join(', ')}</div>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="rounded p-1 text-gray-400 hover:text-blue-600 shrink-0">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <ChevronDown className={cn('h-4 w-4 text-gray-400 shrink-0 transition-transform', expanded && 'rotate-180')} />
      </div>
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {profile.sections.map((s) => (
              <span key={s} className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                {SECTIONS_META[s]?.label ?? s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileModal({ profile, areas, onClose }: {
  profile?: ProfileRow; areas: string[]; onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name,     setName]     = useState(profile?.name ?? '')
  const [selected, setSelected] = useState<Set<SectionCode>>(new Set(profile?.sections ?? []))
  const [error,    setError]    = useState('')

  function toggleSection(s: SectionCode) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const sections = Array.from(selected)
      const res = profile
        ? await updateProfile(profile.id, { name, sections })
        : await createProfile({ name, sections })
      if (res.ok) { onClose(); router.refresh() }
      else setError((res as any).error)
    })
  }

  const allSections = Object.entries(SECTIONS) as [SectionCode, string][]
  const sectionsByArea = new Map<string, [SectionCode, string][]>()
  for (const [code] of allSections) {
    const area = SECTIONS_META[code].area
    if (!sectionsByArea.has(area)) sectionsByArea.set(area, [])
    sectionsByArea.get(area)!.push([code, SECTIONS_META[code].label])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{profile ? 'Modifica profilo' : 'Nuovo profilo'}</h2>
          <button type="button" onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome profilo *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Sezioni abilitate</p>
            <div className="space-y-3">
              {Array.from(sectionsByArea.entries()).map(([area, sections]) => (
                <div key={area}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{area}</p>
                  <div className="space-y-1">
                    {sections.map(([code, label]) => (
                      <label key={code} className="flex items-center gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={selected.has(code)} onChange={() => toggleSection(code)}
                          className="h-4 w-4 rounded border-gray-300 text-purple-600" />
                        <span className="text-sm text-gray-700">{label}</span>
                        <span className="text-xs text-gray-400">{SECTIONS_META[code].description}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={isPending}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Annulla
            </button>
            <button type="submit" disabled={isPending || !name.trim()}
              className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
              {isPending ? 'Salvataggio…' : profile ? 'Salva' : 'Crea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Ruoli ────────────────────────────────────────────────────────────────────

function RolesTab({ roles, profiles }: { roles: RoleRow[]; profiles: ProfileRow[] }) {
  const [showCreate, setShowCreate] = useState(false)
  const [editRole,   setEditRole]   = useState<RoleRow | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">I ruoli aggregano più profili e vengono assegnati agli utenti.</p>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuovo ruolo
        </button>
      </div>

      {roles.map((r) => (
        <div key={r.id} className="bg-white rounded-xl border border-gray-200 flex items-center gap-3 px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 shrink-0">
            <Shield className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm text-gray-900">{r.name}</div>
            <div className="text-xs text-gray-500">
              {r.profiles.length > 0
                ? r.profiles.map((p) => p.name).join(', ')
                : <span className="italic">Nessun profilo</span>}
            </div>
          </div>
          <button type="button" onClick={() => setEditRole(r)}
            className="rounded p-1 text-gray-400 hover:text-blue-600">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {(showCreate || editRole) && (
        <RoleModal
          role={editRole ?? undefined}
          profiles={profiles}
          onClose={() => { setShowCreate(false); setEditRole(null) }}
        />
      )}
    </div>
  )
}

function RoleModal({ role, profiles, onClose }: {
  role?: RoleRow; profiles: ProfileRow[]; onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name,        setName]       = useState(role?.name ?? '')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(role?.profiles.map((p) => p.id) ?? []))
  const [error,       setError]      = useState('')

  function toggle(id: string) {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const profileIds = Array.from(selectedIds)
      const res = role
        ? await updateRole(role.id, { name, profileIds })
        : await createRole({ name, profileIds })
      if (res.ok) { onClose(); router.refresh() }
      else setError((res as any).error)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{role ? 'Modifica ruolo' : 'Nuovo ruolo'}</h2>
          <button type="button" onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome ruolo *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Profili inclusi</p>
            <div className="space-y-1">
              {profiles.map((p) => (
                <label key={p.id} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggle(p.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                  <span className="text-sm text-gray-700">{p.name}</span>
                  <span className="text-xs text-gray-400">({p.sections.length} sezioni)</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={isPending}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Annulla
            </button>
            <button type="submit" disabled={isPending || !name.trim()}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {isPending ? 'Salvataggio…' : role ? 'Salva' : 'Crea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
