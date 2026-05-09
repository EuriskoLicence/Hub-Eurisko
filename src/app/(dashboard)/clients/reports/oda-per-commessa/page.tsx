import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getOdaPerCommessaReport, getCommessaFilterClients, getCommessaFilterProjects } from './actions'
import { Tag, BarChart2, FileSpreadsheet } from 'lucide-react'

export const metadata = { title: 'Report OdA per commessa' }

type SP = { clientId?: string; projectId?: string }

function fmtEur(s: string | null) {
  if (s === null) return '—'
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(s))
}
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s + 'T00:00:00').toLocaleDateString('it-IT')
}

export default async function OdaPerCommessaReportPage({ searchParams }: { searchParams: SP }) {
  const session = await auth()
  if (!session || !hasSection(session, 'PURCHASE_ORDERS_VIEW')) redirect('/dashboard')

  const clientId  = searchParams.clientId  || null
  const projectId = searchParams.projectId || null

  const [rows, filterClients, filterProjects] = await Promise.all([
    getOdaPerCommessaReport({ clientId, projectId }),
    getCommessaFilterClients(),
    getCommessaFilterProjects(clientId),
  ])

  const exportParams = new URLSearchParams()
  if (clientId)  exportParams.set('clientId',  clientId)
  if (projectId) exportParams.set('projectId', projectId)

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fuchsia-100">
          <Tag className="h-5 w-5 text-fuchsia-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">OdA per commessa</h1>
          <p className="text-sm text-gray-500">Una riga per ogni commessa × posizione OdA. Le commesse senza OdA sono comunque elencate (escluse tipologie «NO OdA»).</p>
        </div>
      </div>

      <form method="get" className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
            <select
              name="clientId"
              defaultValue={clientId ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            >
              <option value="">Tutti</option>
              {filterClients.map((c) => (
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
              className="rounded-lg border border-gray-200 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            >
              <option value="">Tutti</option>
              {filterProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-700"
            >
              Filtra
            </button>
            <a
              href="/clients/reports/oda-per-commessa"
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Reimposta
            </a>
          </div>
        </div>
      </form>

      {rows.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4">
          <span className="text-sm text-gray-500">{rows.length} righe trovate</span>
          <a
            href={`/clients/reports/oda-per-commessa/export?${exportParams}`}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Esporta Excel
          </a>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <BarChart2 className="mx-auto h-10 w-10 text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">Nessun dato per i filtri selezionati.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Cod. cl.</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Cliente</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Cod. progetto</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Progetto</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Cod. comm.</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Commessa</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Tipologia</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Cod. OdA</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">N° cliente</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Data OdA</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Resp. OdA</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Pos.</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Descrizione pos.</th>
                <th className="text-right px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Importo pos.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, idx) => (
                <tr key={`${r.engagementId}-${r.lineId ?? `empty-${idx}`}`} className="hover:bg-gray-50">
                  <td className="px-2 py-2 font-mono text-gray-500 whitespace-nowrap">{r.clientCode}</td>
                  <td className="px-2 py-2 text-gray-900 max-w-[140px] truncate" title={r.clientName}>{r.clientName}</td>
                  <td className="px-2 py-2 font-mono text-gray-500 whitespace-nowrap">{r.projectCode}</td>
                  <td className="px-2 py-2 text-gray-700 max-w-[150px] truncate" title={r.projectName}>{r.projectName}</td>
                  <td className="px-2 py-2 font-mono text-gray-500 whitespace-nowrap">{r.engagementCode}</td>
                  <td className="px-2 py-2 text-gray-700 max-w-[150px] truncate" title={r.engagementName}>
                    {r.engagementName}
                    {r.conclusa && <span className="ml-1 text-[10px] text-emerald-700">(concl.)</span>}
                  </td>
                  <td className="px-2 py-2 text-gray-500 whitespace-nowrap">{r.engagementTypeName}</td>
                  <td className="px-2 py-2 font-mono whitespace-nowrap">
                    {r.poCode ?? <span className="text-amber-600 italic text-[11px]">Nessun OdA</span>}
                  </td>
                  <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{r.poNumber ?? '—'}</td>
                  <td className="px-2 py-2 text-gray-500 whitespace-nowrap">{fmtDate(r.poDate)}</td>
                  <td className="px-2 py-2 text-gray-600 max-w-[130px] truncate" title={r.responsibleName ?? ''}>{r.responsibleName ?? '—'}</td>
                  <td className="px-2 py-2 font-mono text-gray-500 whitespace-nowrap">{r.lineCode ?? '—'}</td>
                  <td className="px-2 py-2 text-gray-700 max-w-[180px] truncate" title={r.description ?? ''}>{r.description ?? '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap text-gray-700">{fmtEur(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
