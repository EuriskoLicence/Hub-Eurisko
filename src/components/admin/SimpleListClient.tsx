'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, X, CheckCircle2, XCircle } from 'lucide-react'
import {
  createAbsenceType, updateAbsenceType,
  createEngagementType, updateEngagementType,
} from '@/app/(dashboard)/admin/actions'

type Item = { id: string; code?: string; shortCode?: string | null; label: string; active: boolean; partTimeOnly?: boolean }
type Type = 'absences' | 'engagement-types'

type Props = { type: Type; items: Item[] }

export function SimpleListClient({ type, items }: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [editItem,   setEditItem]   = useState<Item | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          <Plus className="h-4 w-4" />
          {type === 'absences' ? 'Nuova voce' : 'Nuova tipologia'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {type === 'absences' && (
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Cod. breve</th>
              )}
              <th className="text-left px-4 py-3 font-medium text-gray-600">Label</th>
              {type === 'absences' && (
                <th className="text-center px-4 py-3 font-medium text-gray-600 w-24">Solo PT</th>
              )}
              <th className="text-center px-4 py-3 font-medium text-gray-600 w-20">Attivo</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  Nessun elemento.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                {type === 'absences' && (
                  <td className="px-4 py-3">
                    {item.shortCode
                      ? <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-gray-700">{item.shortCode}</span>
                      : <span className="text-xs text-red-400 italic">mancante</span>
                    }
                  </td>
                )}
                <td className="px-4 py-3 text-gray-900">{item.label}</td>
                {type === 'absences' && (
                  <td className="px-4 py-3 text-center">
                    {item.partTimeOnly
                      ? <CheckCircle2 className="h-4 w-4 text-blue-500 inline" />
                      : <span className="text-xs text-gray-300">—</span>
                    }
                  </td>
                )}
                <td className="px-4 py-3 text-center">
                  {item.active
                    ? <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                    : <XCircle     className="h-4 w-4 text-gray-300 inline" />
                  }
                </td>
                <td className="px-2 py-3">
                  <button type="button" onClick={() => setEditItem(item)}
                    className="rounded p-1 text-gray-400 hover:text-blue-600">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showCreate || editItem) && (
        <ItemModal
          type={type}
          item={editItem ?? undefined}
          onClose={() => { setShowCreate(false); setEditItem(null) }}
        />
      )}
    </div>
  )
}

function ItemModal({ type, item, onClose }: { type: Type; item?: Item; onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [shortCode,    setShortCode]    = useState(item?.shortCode    ?? '')
  const [label,        setLabel]        = useState(item?.label        ?? '')
  const [active,       setActive]       = useState(item?.active       ?? true)
  const [partTimeOnly, setPartTimeOnly] = useState(item?.partTimeOnly ?? false)
  const [error,        setError]        = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      let res
      if (type === 'absences') {
        res = item
          ? await updateAbsenceType(item.id, { shortCode, label, active, partTimeOnly })
          : await createAbsenceType({ shortCode, label, partTimeOnly })
      } else {
        res = item
          ? await updateEngagementType(item.id, { name: label, active })
          : await createEngagementType({ name: label })
      }
      if (res.ok) { onClose(); router.refresh() }
      else setError((res as any).error)
    })
  }

  const shortCodeValid = shortCode.trim().length === 0 || /^[A-Z0-9]{1,2}$/i.test(shortCode.trim())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {item ? 'Modifica' : (type === 'absences' ? 'Nuova voce assenza' : 'Nuova tipologia commessa')}
          </h2>
          <button type="button" onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

          {/* Codice breve — sempre visibile per assenze */}
          {type === 'absences' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Codifica breve * <span className="text-gray-400 font-normal">(2 caratteri alfanumerici)</span>
              </label>
              <input
                type="text"
                value={shortCode}
                maxLength={2}
                onChange={(e) => { setShortCode(e.target.value.toUpperCase()); setError('') }}
                placeholder="es. FE"
                className="w-20 rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm font-mono tracking-widest
                           focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
              {shortCode.length > 0 && shortCode.length < 2 && (
                <p className="mt-1 text-xs text-amber-600">Inserisci esattamente 2 caratteri</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {type === 'absences' ? 'Label *' : 'Nome *'}
            </label>
            <input type="text" value={label}
              onChange={(e) => { setLabel(e.target.value); setError('') }}
              placeholder={type === 'absences' ? 'es. Ferie' : 'es. Time & Material'}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-gray-500" />
          </div>

          {type === 'absences' && (
            <div className="flex items-center gap-2">
              <input id="item-part-time-only" type="checkbox" checked={partTimeOnly} onChange={(e) => setPartTimeOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-500" />
              <label htmlFor="item-part-time-only" className="text-sm text-gray-700">
                Solo utenti part time
              </label>
            </div>
          )}
          {item && (
            <div className="flex items-center gap-2">
              <input id="item-active" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-gray-600" />
              <label htmlFor="item-active" className="text-sm text-gray-700">Attivo</label>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={isPending}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Annulla
            </button>
            <button
              type="submit"
              disabled={
                isPending ||
                !label.trim() ||
                (type === 'absences' && shortCode.trim().length !== 2)
              }
              className="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">
              {isPending ? 'Salvataggio…' : item ? 'Salva' : 'Crea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
