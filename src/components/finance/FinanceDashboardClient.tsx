'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import { LayoutDashboard, Clock, AlertTriangle, CheckCircle2, Download, Bell, Eye, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserMonthRow } from '@/app/(dashboard)/finance/actions'

type Period = { year: number; month: number; label: string }
type MissingUser = { userId: string; fullName: string; email: string }

type Props = {
  rows:         UserMonthRow[]
  missingUsers: MissingUser[]
  currentYear:  number
  currentMonth: number
  periods:      Period[]
  canExport:    boolean
}

const STATUS_LABEL: Record<string, string> = {
  draft:               'Bozza',
  approved:            'Approvata/o',
  amendment_requested: 'Rettifica richiesta',
  amendment_rejected:  'Rettifica rifiutata',
}

const STATUS_CLASS: Record<string, string> = {
  draft:               'bg-gray-100 text-gray-600',
  approved:            'bg-green-100 text-green-700',
  amendment_requested: 'bg-blue-100 text-blue-700',
  amendment_rejected:  'bg-red-100 text-red-700',
}

export function FinanceDashboardClient({ rows, missingUsers, currentYear, currentMonth, periods, canExport }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [filter,       setFilter]       = useState<'all' | 'missing' | 'pending'>('all')
  const [reminderSent, setReminderSent] = useState(false)
  const [isPending,    startTransition] = useTransition()

  async function handleRemind() {
    startTransition(async () => {
      const res = await fetch('/api/finance/remind', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ year: currentYear, month: currentMonth }),
      })
      if (res.ok) setReminderSent(true)
    })
  }

  function handlePeriodChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [y, m] = e.target.value.split('-')
    router.push(`${pathname}?year=${y}&month=${m}`)
  }

  // Stats
  const submitted    = rows.filter((r) => r.timesheetStatus && r.timesheetStatus !== 'draft')
  const pendingAmend = rows.filter((r) => r.timesheetStatus === 'amendment_requested')
  const totalHours   = submitted.reduce((s, r) => s + r.totalHours, 0)

  // Filtered rows
  const filteredRows = filter === 'missing'
    ? rows.filter((r) => !r.timesheetStatus || r.timesheetStatus === 'draft')
    : filter === 'pending'
    ? rows.filter((r) => r.timesheetStatus === 'amendment_requested')
    : rows

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100">
            <LayoutDashboard className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard Consuntivazioni</h1>
            <p className="text-sm text-gray-500">Riepilogo mensile consuntivazioni per mese di competenza</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            defaultValue={`${currentYear}-${currentMonth}`}
            onChange={handlePeriodChange}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {periods.map((p) => (
              <option key={`${p.year}-${p.month}`} value={`${p.year}-${p.month}`}>{p.label}</option>
            ))}
          </select>
          {canExport && (
            <div className="flex items-center gap-2">
              <a
                href={`/api/finance/export/timesheet?year=${currentYear}&month=${currentMonth}`}
                className="flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium
                           text-white hover:bg-teal-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Excel assenze
              </a>
              <a
                href={`/api/finance/export/timesheet/pdf?year=${currentYear}&month=${currentMonth}`}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium
                           text-white hover:bg-red-700 transition-colors"
              >
                <FileText className="h-4 w-4" />
                PDF assenze
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Consuntivazioni inviate"
          value={`${submitted.length} / ${rows.length}`}
          icon={<CheckCircle2 className="h-5 w-5 text-indigo-500" />}
          color="bg-indigo-50"
          border="border-indigo-100"
        />
        <StatCard
          label="Ore totali"
          value={`${totalHours.toFixed(0)} h`}
          icon={<Clock className="h-5 w-5 text-indigo-400" />}
          color="bg-indigo-50"
          border="border-indigo-100"
        />
      </div>

      {/* Alert non compilate */}
      {missingUsers.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  {missingUsers.length} {missingUsers.length === 1 ? 'utente non ha' : 'utenti non hanno'} ancora inviato la consuntivazione
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  {missingUsers.map((u) => u.fullName).join(', ')}
                </p>
              </div>
            </div>
            {!reminderSent ? (
              <button
                type="button"
                onClick={handleRemind}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium
                           text-white hover:bg-amber-700 shrink-0 disabled:opacity-50"
              >
                <Bell className="h-3.5 w-3.5" />
                {isPending ? 'Invio…' : 'Invia sollecito'}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-green-700 font-medium shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Sollecito inviato
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'missing', 'pending'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'border border-gray-300 text-gray-600 hover:bg-gray-50',
            )}
          >
            {f === 'all' ? 'Tutti' : f === 'missing' ? 'Non compilati' : 'Rettifiche'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Utente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Consuntivazione</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Ore</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">
                    Nessun risultato.
                  </td>
                </tr>
              )}
              {filteredRows.map((r) => (
                <tr key={r.userId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.fullName}</div>
                    <div className="text-xs text-gray-400">{r.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.timesheetStatus ? (
                      <Link
                        href={`/finance/timesheet/${r.userId}/${currentYear}/${currentMonth}`}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-75',
                          STATUS_CLASS[r.timesheetStatus],
                        )}
                      >
                        {STATUS_LABEL[r.timesheetStatus] ?? r.timesheetStatus}
                        <Eye className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-400">
                        Non compilata
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {r.totalHours > 0 ? `${r.totalHours} h` : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color, border }: { label: string; value: string | number; icon: React.ReactNode; color: string; border?: string }) {
  return (
    <div className={cn('rounded-xl p-4 space-y-2 border', color, border ?? 'border-transparent')}>
      <div className="flex items-center justify-between">
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 leading-tight">{label}</div>
    </div>
  )
}
