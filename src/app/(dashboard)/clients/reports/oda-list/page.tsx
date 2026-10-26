import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getOdaListReport, getOdaFilterClients, getOdaFilterResponsibles, getOdaFilterLineStatuses } from './actions'
import { checkCoherence, isCoherenceIssue, hasForeignCurrency, type Coherence } from './coherence'
import { ShoppingCart, BarChart2, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react'

export const metadata = { title: 'Report Lista OdA' }

type SP = { clientId?: string; responsibleId?: string; lineStatusId?: string }

function fmtEur(s: string | null) {
  if (s === null) return '—'
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(s))
}
function fmtEurNum(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}
function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('it-IT')
}

function CoherenceBadge({ c }: { c: Coherence }) {
  if (c.kind === 'na') return <span className="text-gray-300">—</span>
  if (c.kind === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <CheckCircle2 className="h-3 w-3" />Coerente
      </span>
    )
  }
  const tone = c.kind === 'over' || c.kind === 'negative'
    ? 'text-red-700 bg-red-50 border-red-200'
    : 'text-amber-800 bg-amber-50 border-amber-200'
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${tone}`}>
      <AlertTriangle className="h-3 w-3 shrink-0" />{c.label}
    </span>
  )
}

export default async function OdaListReportPage({ searchParams }: { searchParams: SP }) {
  const session = await auth()
  if (!session || !hasSection(session, 'PURCHASE_ORDERS_VIEW')) redirect('/dashboard')

  const clientId      = searchParams.clientId      || null
  const responsibleId = searchParams.responsibleId || null
  const lineStatusId  = searchParams.lineStatusId  || null

  const [rows, filterClients, filterResponsibles, filterLineStatuses] = await Promise.all([
    getOdaListReport({ clientId, responsibleId, lineStatusId }),
    getOdaFilterClients(),
    getOdaFilterResponsibles(),
    getOdaFilterLineStatuses(),
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
  if (clientId)      exportParams.set('clientId',      clientId)
  if (responsibleId) exportParams.set('responsibleId', responsibleId)
  if (lineStatusId)  exportParams.set('lineStatusId',  lineStatusId)

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
          <ShoppingCart className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lista OdA</h1>
          <p className="text-sm text-gray-500">Una riga per ogni testata × posizione. OdA senza posizioni mostrate con campi posizione vuoti.</p>
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
              className="rounded-lg border border-gray-200 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Tutti</option>
              {filterClients.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Responsabile</label>
            <select
              name="responsibleId"
              defaultValue={responsibleId ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Tutti</option>
              {filterResponsibles.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Stato posizione</label>
            <select
              name="lineStatusId"
              defaultValue={lineStatusId ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Tutti</option>
              {filterLineStatuses.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
            >
              Filtra
            </button>
            <a
              href="/clients/reports/oda-list"
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Reimposta
            </a>
          </div>
        </div>
      </form>

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
            href={`/clients/reports/oda-list/export?${exportParams}`}
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
          <p className="text-sm text-gray-400">Nessun OdA trovato per i filtri selezionati.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Cod. OdA</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">N° cliente</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Data</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Cod. cl.</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Cliente</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Responsabile</th>
                <th className="text-right px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Tot. OdA</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Pos.</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Rif. esterno</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Descrizione</th>
                <th className="text-right px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Importo</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Cod. progetto</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Progetto</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Cod. comm.</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Commessa</th>
                <th className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap">Stato pos.</th>
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
                  key={`${r.poId}-${r.lineId ?? `empty-${idx}`}`}
                  className={canSeeInvoicing && isCoherenceIssue(coh) ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-gray-50'}
                >
                  <td className="px-2 py-2 font-mono whitespace-nowrap">
                    <span className="font-semibold text-gray-900">{r.poCode}</span>
                    {r.needsReview && (
                      <AlertTriangle className="inline h-3 w-3 ml-1 text-red-500" aria-label="Da rivedere" />
                    )}
                  </td>
                  <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{r.poNumber}</td>
                  <td className="px-2 py-2 text-gray-500 whitespace-nowrap">{fmtDate(r.poDate)}</td>
                  <td className="px-2 py-2 font-mono text-gray-500 whitespace-nowrap">{r.clientCode}</td>
                  <td className="px-2 py-2 text-gray-900 max-w-[140px] truncate" title={r.clientName}>{r.clientName}</td>
                  <td className="px-2 py-2 text-gray-600 max-w-[130px] truncate" title={r.responsibleName}>{r.responsibleName}</td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap font-semibold text-gray-900">{fmtEur(r.totalAmount)}</td>
                  <td className="px-2 py-2 font-mono text-gray-500 whitespace-nowrap">{r.lineCode ?? '—'}</td>
                  <td className="px-2 py-2 text-gray-600 max-w-[130px] truncate" title={r.externalReference ?? ''}>{r.externalReference ?? '—'}</td>
                  <td className="px-2 py-2 text-gray-700 max-w-[180px] truncate" title={r.description ?? ''}>{r.description ?? <span className="text-amber-600 italic">Nessuna posizione</span>}</td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap text-gray-700">{fmtEur(r.amount)}</td>
                  <td className="px-2 py-2 font-mono text-gray-500 whitespace-nowrap">{r.projectCode ?? '—'}</td>
                  <td className="px-2 py-2 text-gray-700 max-w-[130px] truncate" title={r.projectName ?? ''}>{r.projectName ?? '—'}</td>
                  <td className="px-2 py-2 font-mono text-gray-500 whitespace-nowrap">{r.engagementCode ?? '—'}</td>
                  <td className="px-2 py-2 text-gray-700 max-w-[130px] truncate" title={r.engagementName ?? ''}>{r.engagementName ?? '—'}</td>
                  <td className="px-2 py-2 text-gray-600 whitespace-nowrap">
                    {r.lineStatusCode
                      ? <span className="font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">{r.lineStatusCode}</span>
                      : '—'}
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
