'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, X, CheckCircle2, XCircle, Car } from 'lucide-react'
import {
  createExpenseCategory, updateExpenseCategory,
  createVehicleType,    updateVehicleType,
} from '@/app/(dashboard)/admin/actions'
import type { ExpenseCategoryRow, VehicleTypeRow } from '@/app/(dashboard)/admin/actions'

type Props = { categories: ExpenseCategoryRow[]; vehicleTypes: VehicleTypeRow[] }

export function ExpenseCatClient({ categories, vehicleTypes }: Props) {
  const [tab, setTab] = useState<'categories' | 'vehicles'>('categories')
  const [showCreate,   setShowCreate]   = useState(false)
  const [editCat,      setEditCat]      = useState<ExpenseCategoryRow | null>(null)
  const [showVeh,      setShowVeh]      = useState(false)
  const [editVeh,      setEditVeh]      = useState<VehicleTypeRow | null>(null)

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {(['categories', 'vehicles'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'categories' ? 'Categorie' : 'Tipi veicolo'}
          </button>
        ))}
      </div>

      {tab === 'categories' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button type="button" onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              <Plus className="h-4 w-4" />
              Nuova categoria
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Codice</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Label</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 w-28">Allegato obl.</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 w-20">Km-based</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 w-20">Attiva</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.code}</td>
                    <td className="px-4 py-3 text-gray-900">{c.label}</td>
                    <td className="px-4 py-3 text-center">
                      {c.requiresAttachment ? <CheckCircle2 className="h-4 w-4 text-green-500 inline" /> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.isKmBased ? <CheckCircle2 className="h-4 w-4 text-blue-500 inline" /> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.active ? <CheckCircle2 className="h-4 w-4 text-green-500 inline" /> : <XCircle className="h-4 w-4 text-gray-300 inline" />}
                    </td>
                    <td className="px-2 py-3">
                      <button type="button" onClick={() => setEditCat(c)} className="rounded p-1 text-gray-400 hover:text-green-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'vehicles' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button type="button" onClick={() => setShowVeh(true)}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              <Plus className="h-4 w-4" />
              Nuovo veicolo
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo veicolo</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">€/km</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 w-20">Attivo</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vehicleTypes.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 flex items-center gap-2 text-gray-900">
                      <Car className="h-4 w-4 text-gray-400" />
                      {v.name}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">€ {parseFloat(v.ratePerKm).toFixed(4)}</td>
                    <td className="px-4 py-3 text-center">
                      {v.active ? <CheckCircle2 className="h-4 w-4 text-green-500 inline" /> : <XCircle className="h-4 w-4 text-gray-300 inline" />}
                    </td>
                    <td className="px-2 py-3">
                      <button type="button" onClick={() => setEditVeh(v)} className="rounded p-1 text-gray-400 hover:text-green-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(showCreate || editCat) && (
        <CatModal cat={editCat ?? undefined} onClose={() => { setShowCreate(false); setEditCat(null) }} />
      )}
      {(showVeh || editVeh) && (
        <VehModal veh={editVeh ?? undefined} onClose={() => { setShowVeh(false); setEditVeh(null) }} />
      )}
    </div>
  )
}

function CatModal({ cat, onClose }: { cat?: ExpenseCategoryRow; onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [code,     setCode]     = useState(cat?.code  ?? '')
  const [label,    setLabel]    = useState(cat?.label  ?? '')
  const [reqAtt,   setReqAtt]   = useState(cat?.requiresAttachment ?? false)
  const [isKm,     setIsKm]     = useState(cat?.isKmBased ?? false)
  const [active,   setActive]   = useState(cat?.active ?? true)
  const [error,    setError]    = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = cat
        ? await updateExpenseCategory(cat.id, { label, requiresAttachment: reqAtt, isKmBased: isKm, active })
        : await createExpenseCategory({ code, label, requiresAttachment: reqAtt, isKmBased: isKm })
      if (res.ok) { onClose(); router.refresh() }
      else setError((res as any).error)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{cat ? 'Modifica categoria' : 'Nuova categoria'}</h2>
          <button type="button" onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

          {!cat && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Codice *</label>
              <input type="text" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setError('') }}
                placeholder="es. PAST" required
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Label *</label>
            <input type="text" value={label} onChange={(e) => { setLabel(e.target.value); setError('') }} required
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          <div className="space-y-2">
            {[
              { id: 'req-att', checked: reqAtt, set: setReqAtt, label: 'Allegato obbligatorio' },
              { id: 'is-km',   checked: isKm,   set: setIsKm,   label: 'Basata su km (rimborso chilometrico)' },
              ...(cat ? [{ id: 'cat-active', checked: active, set: setActive, label: 'Attiva' }] : []),
            ].map(({ id, checked, set, label: lbl }) => (
              <div key={id} className="flex items-center gap-2">
                <input id={id} type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600" />
                <label htmlFor={id} className="text-sm text-gray-700">{lbl}</label>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={isPending}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Annulla
            </button>
            <button type="submit" disabled={isPending || !label.trim()}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {isPending ? 'Salvataggio…' : cat ? 'Salva' : 'Crea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function VehModal({ veh, onClose }: { veh?: VehicleTypeRow; onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name,   setName]   = useState(veh?.name ?? '')
  const [rate,   setRate]   = useState(veh ? parseFloat(veh.ratePerKm).toFixed(4) : '')
  const [active, setActive] = useState(veh?.active ?? true)
  const [error,  setError]  = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = veh
        ? await updateVehicleType(veh.id, { name, ratePerKm: rate, active })
        : await createVehicleType({ name, ratePerKm: rate })
      if (res.ok) { onClose(); router.refresh() }
      else setError((res as any).error)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{veh ? 'Modifica veicolo' : 'Nuovo tipo veicolo'}</h2>
          <button type="button" onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome *</label>
            <input type="text" value={name} onChange={(e) => { setName(e.target.value); setError('') }} required
              placeholder="es. Autovettura privata"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tariffa (€/km) *</label>
            <input type="number" step="0.0001" min="0" value={rate} onChange={(e) => { setRate(e.target.value); setError('') }} required
              placeholder="es. 0.4000"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          {veh && (
            <div className="flex items-center gap-2">
              <input id="veh-active" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-green-600" />
              <label htmlFor="veh-active" className="text-sm text-gray-700">Attivo</label>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={isPending}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Annulla
            </button>
            <button type="submit" disabled={isPending || !name.trim() || !rate}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {isPending ? 'Salvataggio…' : veh ? 'Salva' : 'Crea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
