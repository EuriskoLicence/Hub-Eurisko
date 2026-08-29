import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getMonthlyHoursReport } from './actions'
import {
  getProjectManagers, getActiveClients, getActiveProjects,
  getActiveEngagements, getActiveTimesheetUsers,
} from '../ore-commessa/actions'
import { CalendarRange, FileSpreadsheet } from 'lucide-react'

export const metadata = { title: 'Ore mensili per commessa e utente' }

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

type SP = {
  fromYear?:      string
  fromMonth?:     string
  toYear?:        string
  toMonth?:       string
  responsibleId?: string
  clientId?:      string
  projectId?:     string
  engagementId?:  string
  userId?:        string
}

export default async function OreMensiliPage({ searchParams }: { searchParams: SP }) {
  const session = await auth()
  if (!session || !hasSection(session, 'CLIENTS_VIEW')) redirect('/dashboard')

  const now = new Date()

  // Default: da gennaio dell'anno precedente al mese corrente
  const fromYear  = searchParams.fromYear  ? parseInt(searchParams.fromYear)  : now.getFullYear() - 1
  const fromMonth = searchParams.fromMonth ? parseInt(searchParams.fromMonth) : 1
  const toYear    = searchParams.toYear    ? parseInt(searchParams.toYear)    : now.getFullYear()
  const toMonth   = searchParams.toMonth   ? parseInt(searchParams.toMonth)   : now.getMonth() + 1

  const responsibleId = searchParams.responsibleId || null
  const clientId      = searchParams.clientId      || null
  const projectId     = searchParams.projectId     || null
  const engagementId  = searchParams.engagementId  || null
  const userId        = searchParams.userId        || null

  const [report, managers, activeClients, activeProjects, activeEngagements, activeUsers] =
    await Promise.all([
      getMonthlyHoursReport({
        fromYear, fromMonth, toYear, toMonth,
        responsibleId, clientId, projectId, engagementId, userId,
      }),
      getProjectManagers(),
      getActiveClients(),
      getActiveProjects(clientId),
      getActiveEngagements(projectId),
      getActiveTimesheetUsers(),
    ])

  const { months, rows, monthTotals, grandTotal } = report

  const yearOptions = Array.from({ length: 8 }, (_, i) => now.getFullYear() - i)

  const exportParams = new URLSearchParams({
    fromYear:  String(fromYear),
    fromMonth: String(fromMonth),
    toYear:    String(toYear),
    toMonth:   String(toMonth),
  })
  if (responsibleId) exportParams.set('responsibleId', responsibleId)
  if (clientId)      exportParams.set('clientId',      clientId)
  if (projectId)     exportParams.set('projectId',     projectId)
  if (engagementId)  exportParams.set('engagementId',  engagementId)
  if (userId)        exportParams.set('userId',        userId)

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100">
          <CalendarRange className="h-5 w-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ore mensili per commessa e utente</h1>
          <p className="text-sm text-gray-500">
            Ore consuntivate (ordinarie + extra) con una colonna per ogni mese del periodo
          </p>
        </div>
      </div>

      {/* Filtri */}
      <form method="get" className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        {/* Riga 1: periodo Da → A */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Da mese</label>
            <select
              name="fromMonth"
              defaultValue={fromMonth}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {IT_MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Da anno</label>
            <select
              name="fromYear"
              defaultValue={fromYear}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <span className="pb-2 text-gray-300">→</span>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">A mese</label>
            <select
              name="toMonth"
              defaultValue={toMonth}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {IT_MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">A anno</label>
            <select
              name="toYear"
              defaultValue={toYear}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Responsabile</label>
            <select
              name="responsibleId"
              defaultValue={responsibleId ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tutti</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
        </div>

        {/* Riga 2: Cliente · Progetto · Commessa · Utente */}
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
            <select
              name="clientId"
              defaultValue={clientId ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tutti</option>
              {activeClients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Progetto {clientId && <span className="text-gray-400 text-[10px]">(filtrato per cliente)</span>}
            </label>
            <select
              name="projectId"
              defaultValue={projectId ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tutti</option>
              {activeProjects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Commessa {projectId && <span className="text-gray-400 text-[10px]">(filtrata per progetto)</span>}
            </label>
            <select
              name="engagementId"
              defaultValue={engagementId ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tutte</option>
              {activeEngagements.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Utente</label>
            <select
              name="userId"
              defaultValue={userId ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tutti</option>
              {activeUsers.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Filtra
          </button>
          <a
            href="/clients/reports/ore-mensili"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Reimposta
          </a>
        </div>
      </form>

      {/* Totale + Export */}
      {rows.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4">
          <span className="text-sm text-gray-500">
            Totale ore — {IT_MONTHS[fromMonth - 1]} {fromYear} → {IT_MONTHS[toMonth - 1]} {toYear}
            <span className="ml-2 text-gray-400">({rows.length} righe · {months.length} mesi)</span>
          </span>
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold text-gray-900">{grandTotal.toFixed(1)} h</span>
            <a
              href={`/clients/reports/ore-mensili/export?${exportParams}`}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </a>
          </div>
        </div>
      )}

      {/* Tabella */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <CalendarRange className="mx-auto h-10 w-10 text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">Nessuna ora consuntivata nel periodo selezionato.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 text-left px-4 py-3 font-medium text-gray-600 min-w-[220px]">
                  Commessa
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-[180px]">Utente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-[160px]">Cliente</th>
                {months.map((m) => (
                  <th key={m.key} className="text-center px-3 py-3 font-medium text-gray-600 whitespace-nowrap min-w-[76px]">
                    {m.label}
                  </th>
                ))}
                <th className="text-center px-4 py-3 font-semibold text-gray-700 bg-gray-100 whitespace-nowrap min-w-[90px]">
                  Totale
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={`${r.engagementId}-${r.userId}`} className="hover:bg-gray-50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 text-gray-900">
                    <div className="font-medium">{r.engagementName}</div>
                    <div className="font-mono text-[10px] text-gray-400">{r.compositeCode}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.userName}</td>
                  <td className="px-4 py-3 text-gray-500">
                    <div>{r.clientName}</div>
                    <div className="text-[11px] text-gray-400">{r.projectName}</div>
                  </td>
                  {months.map((m) => {
                    const h = r.hoursByMonth[m.key]
                    return (
                      <td key={m.key} className="px-3 py-3 text-center tabular-nums text-gray-700">
                        {h ? h : <span className="text-gray-200">—</span>}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center font-semibold tabular-nums text-gray-900 bg-gray-50">
                    {r.totalHours}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td className="sticky left-0 z-10 bg-gray-50 px-4 py-3 font-semibold text-gray-700">Totali</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                {months.map((m) => (
                  <td key={m.key} className="px-3 py-3 text-center font-semibold tabular-nums text-gray-700">
                    {monthTotals[m.key] ?? 0}
                  </td>
                ))}
                <td className="px-4 py-3 text-center font-bold tabular-nums text-gray-900 bg-gray-100">
                  {grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
