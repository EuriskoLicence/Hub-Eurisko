import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import {
  getCommessaList, getFilterClients, getFilterProjects, getFilterEngagementStatuses,
  type ConclusedFilter,
} from './actions'
import { BarChart2, FileSpreadsheet, List, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Report lista commesse' }

type SP = {
  clientId?:        string
  projectId?:       string
  conclusedFilter?: string
  statusId?:        string
}

function HoursCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-300">—</span>
  return <span>{value}h</span>
}

function RemainingCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-300">—</span>
  return (
    <span className={cn(
      'font-medium',
      value < 0 ? 'text-red-600' : value === 0 ? 'text-gray-400' : 'text-green-700',
    )}>
      {value > 0 ? '+' : ''}{value}h
    </span>
  )
}

export default async function ListaCommessePage({ searchParams }: { searchParams: SP }) {
  const session = await auth()
  if (!session || !hasSection(session, 'CLIENTS_VIEW')) redirect('/dashboard')

  const clientId         = searchParams.clientId  || null
  const projectId        = searchParams.projectId || null
  const statusId         = searchParams.statusId  || null
  const conclusedFilter  = (
    ['all', 'open', 'closed'].includes(searchParams.conclusedFilter ?? '')
      ? (searchParams.conclusedFilter as ConclusedFilter)
      : 'all'
  ) as ConclusedFilter

  const [rows, allClients, allProjects, allStatuses] = await Promise.all([
    getCommessaList({ clientId, projectId, conclusedFilter, statusId }),
    getFilterClients(),
    getFilterProjects(clientId),
    getFilterEngagementStatuses(),
  ])

  const exportParams = new URLSearchParams()
  if (clientId)                   exportParams.set('clientId',        clientId)
  if (projectId)                  exportParams.set('projectId',       projectId)
  if (conclusedFilter !== 'all')  exportParams.set('conclusedFilter', conclusedFilter)
  if (statusId)                   exportParams.set('statusId',        statusId)

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
          <List className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Report lista commesse</h1>
          <p className="text-sm text-gray-500">Elenco di tutte le commesse con cliente, progetto e responsabile</p>
        </div>
      </div>

      {/* Filtri */}
      <form method="get" className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
            <select
              name="clientId"
              defaultValue={clientId ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tutti</option>
              {allClients.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Progetto{clientId ? <span className="text-gray-400 text-[10px] ml-1">(filtrato per cliente)</span> : null}
            </label>
            <select
              name="projectId"
              defaultValue={projectId ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tutti</option>
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Conclusa</label>
            <select
              name="conclusedFilter"
              defaultValue={conclusedFilter}
              className="rounded-lg border border-gray-200 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tutte</option>
              <option value="open">Solo non concluse</option>
              <option value="closed">Solo concluse</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Stato</label>
            <select
              name="statusId"
              defaultValue={statusId ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tutti</option>
              {allStatuses.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Filtra
            </button>
            <a
              href="/clients/reports/lista-commesse"
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
            {rows.length} commess{rows.length === 1 ? 'a' : 'e'} trovate
          </span>
          <a
            href={`/clients/reports/lista-commesse/export?${exportParams}`}
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
          <p className="text-sm text-gray-400">Nessuna commessa trovata per i filtri selezionati.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Cod. cl.</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Cliente</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Cod. pr.</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Progetto</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap hidden xl:table-cell">Responsabile</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Cod. comm.</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Commessa</th>
                <th className="text-center px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Conclusa</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Stato</th>
                <th className="text-center px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Scadenza</th>
                <th className="text-right px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Budget</th>
                <th className="text-right px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Consunt.</th>
                <th className="text-right px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Rimanenti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.engagementId} className="hover:bg-gray-50">
                  <td className="px-2 py-2.5 font-mono text-gray-500 whitespace-nowrap">{r.clientCode}</td>
                  <td className="px-2 py-2.5 font-medium text-gray-900 max-w-[140px] truncate" title={r.clientName}>{r.clientName}</td>
                  <td className="px-2 py-2.5 font-mono text-gray-500 whitespace-nowrap">{r.projectCode}</td>
                  <td className="px-2 py-2.5 text-gray-700 max-w-[150px] truncate" title={r.projectName}>{r.projectName}</td>
                  <td className="px-2 py-2.5 text-gray-600 hidden xl:table-cell max-w-[130px] truncate" title={r.responsibleName}>{r.responsibleName}</td>
                  <td className="px-2 py-2.5 font-mono text-gray-500 whitespace-nowrap">{r.engagementCode}</td>
                  <td className="px-2 py-2.5 text-gray-700 max-w-[150px] truncate" title={r.engagementName}>{r.engagementName}</td>
                  <td className="px-2 py-2.5 text-center">
                    {r.conclusa
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 inline" />
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>
                  <td className="px-2 py-2.5 whitespace-nowrap">
                    {r.statusCode
                      ? <span
                          className="inline-block rounded bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-700"
                          title={r.statusDescription ?? undefined}
                        >
                          {r.statusCode}
                        </span>
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums whitespace-nowrap">
                    {r.validUntil === '2999-12-31'
                      ? <span className="text-gray-300">—</span>
                      : <span className={cn(
                          new Date(r.validUntil + 'T00:00:00') < new Date() ? 'text-red-600 font-medium' : 'text-gray-700'
                        )}>
                          {new Date(r.validUntil + 'T00:00:00').toLocaleDateString('it-IT')}
                        </span>
                    }
                  </td>
                  <td className="px-2 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap">
                    <HoursCell value={r.totalHours} />
                  </td>
                  <td className="px-2 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap">
                    {r.workedHours}h
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap">
                    <RemainingCell value={r.remainingHours} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
