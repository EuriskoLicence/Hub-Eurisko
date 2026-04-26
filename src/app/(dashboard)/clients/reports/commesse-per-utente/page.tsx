import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import {
  getCommessePerUtente,
  getFilterUsers,
  getFilterEngagements,
  getFilterResponsibili,
  type ActiveFilter,
} from './actions'
import { BarChart2, FileSpreadsheet, Users } from 'lucide-react'
import { CheckCircle2, XCircle } from 'lucide-react'

export const metadata = { title: 'Elenco commesse per utente' }

type SP = {
  userId?:        string
  engagementId?:  string
  responsibleId?: string
  activeOnly?:    string
}

export default async function CommessePerUtentePage({ searchParams }: { searchParams: SP }) {
  const session = await auth()
  if (!session || !hasSection(session, 'CLIENTS_VIEW')) redirect('/dashboard')

  const userId        = searchParams.userId        || null
  const engagementId  = searchParams.engagementId  || null
  const responsibleId = searchParams.responsibleId || null
  const activeOnly    = (searchParams.activeOnly ?? 'all') as ActiveFilter

  const [rows, allUsers, allEngagements, allResponsibili] = await Promise.all([
    getCommessePerUtente({ userId, engagementId, responsibleId, activeOnly }),
    getFilterUsers(),
    getFilterEngagements(),
    getFilterResponsibili(),
  ])

  const exportParams = new URLSearchParams()
  if (userId)                exportParams.set('userId',        userId)
  if (engagementId)          exportParams.set('engagementId',  engagementId)
  if (responsibleId)         exportParams.set('responsibleId', responsibleId)
  if (activeOnly !== 'all')  exportParams.set('activeOnly',    activeOnly)

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100">
          <Users className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Elenco commesse per utente</h1>
          <p className="text-sm text-gray-500">Tutte le commesse a cui ogni utente è abilitato</p>
        </div>
      </div>

      {/* Filtri */}
      <form method="get" className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap gap-3 items-end">

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Utente</label>
            <select
              name="userId"
              defaultValue={userId ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Tutti</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Commessa</label>
            <select
              name="engagementId"
              defaultValue={engagementId ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Tutte</option>
              {allEngagements.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Responsabile commessa</label>
            <select
              name="responsibleId"
              defaultValue={responsibleId ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Tutti</option>
              {allResponsibili.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Stato commessa</label>
            <select
              name="activeOnly"
              defaultValue={activeOnly}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="all">Tutte</option>
              <option value="active">Solo attive</option>
              <option value="inactive">Solo inattive</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
            >
              Filtra
            </button>
            <a
              href="/clients/reports/commesse-per-utente"
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Reimposta
            </a>
          </div>
        </div>
      </form>

      {/* Conteggio + Export */}
      {rows.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4">
          <span className="text-sm text-gray-500">
            {rows.length} rig{rows.length === 1 ? 'a' : 'he'} trovate
          </span>
          <a
            href={`/clients/reports/commesse-per-utente/export?${exportParams}`}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Esporta Excel
          </a>
        </div>
      )}

      {/* Tabella */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <BarChart2 className="mx-auto h-10 w-10 text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">Nessun risultato per i filtri selezionati.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Utente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Commessa</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Attiva</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Responsabile commessa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => {
                const prevUser = i > 0 ? rows[i - 1].userId : null
                const isNewUser = r.userId !== prevUser
                return (
                  <tr key={`${r.userId}-${r.engagementId}`} className={isNewUser && i > 0 ? 'border-t-2 border-gray-200 hover:bg-gray-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {isNewUser ? r.userName : ''}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="font-mono text-xs text-gray-400 mr-2">{r.engagementCode}</span>
                      {r.engagementName}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.engagementActive
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                        : <XCircle      className="h-4 w-4 text-gray-300 inline" />
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.responsibleName}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
