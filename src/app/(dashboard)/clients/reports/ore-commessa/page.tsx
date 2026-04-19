import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import {
  getHoursReport, getProjectManagers,
  getActiveClients, getActiveProjects, getActiveEngagements, getActiveTimesheetUsers,
} from './actions'
import { ReportTable } from '@/components/clients/ReportTable'
import { BarChart2, FileSpreadsheet, FileText } from 'lucide-react'

export const metadata = { title: 'Report ore per commessa' }

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

type SP = {
  year?:          string
  month?:         string
  responsibleId?: string
  clientId?:      string
  projectId?:     string
  engagementId?:  string
  userId?:        string
}

export default async function OreCommessaPage({ searchParams }: { searchParams: SP }) {
  const session = await auth()
  if (!session || !hasSection(session, 'CLIENTS_VIEW')) redirect('/dashboard')

  const now          = new Date()
  const year         = searchParams.year         ? parseInt(searchParams.year)  : now.getFullYear()
  const month        = searchParams.month        ? parseInt(searchParams.month) : null
  const responsibleId = searchParams.responsibleId || null
  const clientId     = searchParams.clientId     || null
  const projectId    = searchParams.projectId    || null
  const engagementId = searchParams.engagementId || null
  const userId       = searchParams.userId       || null
  const canManage    = hasSection(session, 'CLIENTS_MANAGE')

  const [rows, managers, activeClients, activeProjects, activeEngagements, activeUsers] =
    await Promise.all([
      getHoursReport({ year, month, responsibleId, clientId, projectId, engagementId, userId }),
      getProjectManagers(),
      getActiveClients(),
      getActiveProjects(clientId),
      getActiveEngagements(projectId),
      getActiveTimesheetUsers(),
    ])

  const totalHours = rows.reduce((s, r) => s + r.totalHours, 0)

  const exportParams = new URLSearchParams({ year: String(year) })
  if (month)         exportParams.set('month',         String(month))
  if (responsibleId) exportParams.set('responsibleId', responsibleId)
  if (clientId)      exportParams.set('clientId',      clientId)
  if (projectId)     exportParams.set('projectId',     projectId)
  if (engagementId)  exportParams.set('engagementId',  engagementId)
  if (userId)        exportParams.set('userId',         userId)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
          <BarChart2 className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Report ore per commessa</h1>
          <p className="text-sm text-gray-500">Riepilogo ore consuntivate per cliente, progetto e commessa</p>
        </div>
      </div>

      {/* Filtri */}
      <form method="get" className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        {/* Riga 1: Anno · Mese · Responsabile */}
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Anno <span className="text-red-500">*</span>
            </label>
            <select
              name="year"
              defaultValue={year}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Mese <span className="text-red-500">*</span>
            </label>
            <select
              name="month"
              defaultValue={month ?? ''}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tutti i mesi</option>
              {IT_MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
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
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
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
              {activeClients.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
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
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
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
              {activeEngagements.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
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
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
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
            href="/clients/reports/ore-commessa"
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
            Totale ore — {month ? `${IT_MONTHS[month - 1]} ${year}` : `Anno ${year}`}
          </span>
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold text-gray-900">{totalHours.toFixed(1)} h</span>
            <a
              href={`/clients/reports/ore-commessa/export?${exportParams}`}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </a>
            <a
              href={`/clients/reports/ore-commessa/export/pdf?${exportParams}`}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
            >
              <FileText className="h-4 w-4" />
              PDF
            </a>
          </div>
        </div>
      )}

      {/* Tabella */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <BarChart2 className="mx-auto h-10 w-10 text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">Nessuna ora consuntivata per il periodo selezionato.</p>
        </div>
      ) : (
        <ReportTable rows={rows} showUsers={canManage} />
      )}
    </div>
  )
}
