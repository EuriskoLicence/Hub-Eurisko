import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import {
  getOdaPerCommessaReport,
  getCommessaFilterClients,
  getCommessaFilterProjects,
  getCommessaFilterStatuses,
  getCommessaFilterOdaCodes,
  getCommessaFilterProjectResponsibles,
} from './actions'
import { getOdaFilterResponsibles } from '../oda-list/actions'
import { checkCoherence, isCoherenceIssue, hasForeignCurrency } from '@/lib/oda-coherence'
import { CoherenceBadge } from '@/components/orders/CoherenceBadge'
import { Tag, BarChart2, FileSpreadsheet, AlertTriangle } from 'lucide-react'

export const metadata = { title: 'Report OdA per commessa' }

type SP = {
  clientId?:             string
  projectId?:            string
  statusId?:             string
  odaFilter?:            string
  odaResponsibleId?:     string
  projectResponsibleId?: string
}

function fmtEur(s: string | null) {
  if (s === null) return '—'
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(s))
}
function fmtEurNum(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
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
  const statusId  = searchParams.statusId  || null
  const odaFilter = searchParams.odaFilter || null
  const odaResponsibleId     = searchParams.odaResponsibleId     || null
  const projectResponsibleId = searchParams.projectResponsibleId || null

  const [rows, filterClients, filterProjects, filterStatuses, filterOdaCodes, filterOdaResponsibles, filterProjectResponsibles] =
    await Promise.all([
      getOdaPerCommessaReport({ clientId, projectId, statusId, odaFilter, odaResponsibleId, projectResponsibleId }),
      getCommessaFilterClients(),
      getCommessaFilterProjects(clientId),
      getCommessaFilterStatuses(),
      getCommessaFilterOdaCodes(),
      getOdaFilterResponsibles(),
      getCommessaFilterProjectResponsibles(),
    ])

  // Colonne fatturazione solo per chi ha anche il permesso fatture (stessa regola dell'action)
  const canSeeInvoicing = hasSection(session, 'INVOICES_VIEW')

  const view = rows.map((r) => ({
    r,
    coh: checkCoherence(r.lineStatusCode, r.amount !== null ? Number(r.amount) : null, r.invoicedAmount),
  }))
  const issuesCount     = view.filter((v) => isCoherenceIssue(v.coh)).length
  const foreignCurCount = rows.filter((r) => hasForeignCurrency(r.invoiceCurrencies)).length

  const exportParams = new URLSearchParams()
  if (clientId)             exportParams.set('clientId',             clientId)
  if (projectId)            exportParams.set('projectId',            projectId)
  if (statusId)             exportParams.set('statusId',             statusId)
  if (odaFilter)            exportParams.set('odaFilter',            odaFilter)
  if (odaResponsibleId)     exportParams.set('odaResponsibleId',     odaResponsibleId)
  if (projectResponsibleId) exportParams.set('projectResponsibleId', projectResponsibleId)

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

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Stato commessa</label>
            <select
              name="statusId"
              defaultValue={statusId ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            >
              <option value="">Tutti</option>
              {filterStatuses.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cod. OdA</label>
            <select
              name="odaFilter"
              defaultValue={odaFilter ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            >
              <option value="">Tutti</option>
              <option value="none">— Solo commesse senza OdA —</option>
              {filterOdaCodes.map((o) => (
                <option key={o.code} value={o.code}>{o.code} ({o.number})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Responsabile OdA</label>
            <select
              name="odaResponsibleId"
              defaultValue={odaResponsibleId ?? ''}
              title="Esclude le commesse senza OdA"
              className="rounded-lg border border-gray-200 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            >
              <option value="">Tutti</option>
              {filterOdaResponsibles.map((u) => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Responsabile progetto</label>
            <select
              name="projectResponsibleId"
              defaultValue={projectResponsibleId ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            >
              <option value="">Tutti</option>
              {filterProjectResponsibles.map((u) => (
                <option key={u.id} value={u.id}>{u.label}</option>
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

      {odaResponsibleId && odaFilter === 'none' && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Il filtro «Responsabile OdA» esclude le commesse senza OdA, quindi combinato con
            «Solo commesse senza OdA» non restituisce risultati. Per le commesse senza OdA usa «Responsabile progetto».
          </span>
        </div>
      )}

      {canSeeInvoicing && foreignCurCount > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {foreignCurCount} {foreignCurCount === 1 ? 'posizione ha' : 'posizioni hanno'} documenti in una divisa
            diversa da EUR (la divisa degli OdA). Per queste righe fatturato e importo da fatturare sommano
            valute diverse senza conversione: sono segnalate con l&apos;indicazione della divisa.
          </span>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4">
          <span className="text-sm text-gray-500">
            {rows.length} righe trovate
            {canSeeInvoicing && (
              issuesCount > 0
                ? <span className="ml-2 font-semibold text-amber-700">· {issuesCount} {issuesCount === 1 ? 'incoerenza' : 'incoerenze'} stato/fatturazione</span>
                : <span className="ml-2 text-emerald-600">· nessuna incoerenza stato/fatturazione</span>
            )}
          </span>
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
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Stato comm.</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Cod. OdA</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">N° cliente</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Data OdA</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Resp. OdA</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Pos.</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Descrizione pos.</th>
                <th className="text-right px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Importo pos.</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Stato pos. OdA</th>
                {canSeeInvoicing && (
                  <>
                    <th className="text-right px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Fatturato</th>
                    <th className="text-right px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Da fatturare</th>
                    <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Coerenza stato</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {view.map(({ r, coh }, idx) => (
                <tr
                  key={`${r.engagementId}-${r.lineId ?? `empty-${idx}`}`}
                  className={canSeeInvoicing && isCoherenceIssue(coh) ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-gray-50'}
                >
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
                  <td className="px-2 py-2 whitespace-nowrap">
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
                  <td className="px-2 py-2 font-mono whitespace-nowrap">
                    {r.poCode ?? <span className="text-amber-600 italic text-[11px]">Nessun OdA</span>}
                  </td>
                  <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{r.poNumber ?? '—'}</td>
                  <td className="px-2 py-2 text-gray-500 whitespace-nowrap">{fmtDate(r.poDate)}</td>
                  <td className="px-2 py-2 text-gray-600 max-w-[130px] truncate" title={r.responsibleName ?? ''}>{r.responsibleName ?? '—'}</td>
                  <td className="px-2 py-2 font-mono text-gray-500 whitespace-nowrap">{r.lineCode ?? '—'}</td>
                  <td className="px-2 py-2 text-gray-700 max-w-[180px] truncate" title={r.description ?? ''}>{r.description ?? '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap text-gray-700">{fmtEur(r.amount)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {r.lineStatusCode
                      ? <span
                          className="font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5"
                          title={r.lineStatusDesc ?? undefined}
                        >
                          {r.lineStatusCode}
                        </span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  {canSeeInvoicing && (
                    <>
                      <td
                        className="px-2 py-2 text-right tabular-nums whitespace-nowrap text-gray-700"
                        title={r.invoiceDocs > 0 ? `${r.invoiceDocs} ${r.invoiceDocs === 1 ? 'documento' : 'documenti'}: ${r.invoiceCurrencies.join(', ')}` : undefined}
                      >
                        {fmtEurNum(r.invoicedAmount)}
                        {hasForeignCurrency(r.invoiceCurrencies) && (
                          <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">
                            {r.invoiceCurrencies.join('+')}
                          </span>
                        )}
                      </td>
                      <td className={`px-2 py-2 text-right tabular-nums whitespace-nowrap font-semibold ${
                        r.residualAmount !== null && r.residualAmount < -0.01 ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {fmtEurNum(r.residualAmount)}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <CoherenceBadge c={coh} />
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
