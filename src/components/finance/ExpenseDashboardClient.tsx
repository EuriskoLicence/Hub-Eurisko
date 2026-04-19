'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import { Receipt, Download, Eye, TrendingUp, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExpenseSubmissionRow } from '@/app/(dashboard)/finance/actions'

type Period = { year: number; month: number; label: string }

type Props = {
  rows:         ExpenseSubmissionRow[]
  currentYear:  number
  currentMonth: number
  periods:      Period[]
  canExport:    boolean
}

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

const STATUS_LABEL: Record<string, string> = {
  draft:               'Bozza',
  approved:            'Inviata',
  amendment_requested: 'Rettifica richiesta',
  amendment_rejected:  'Rettifica rifiutata',
}

const STATUS_CLASS: Record<string, string> = {
  draft:               'bg-gray-100 text-gray-600',
  approved:            'bg-green-100 text-green-700',
  amendment_requested: 'bg-blue-100 text-blue-700',
  amendment_rejected:  'bg-red-100 text-red-700',
}

export function ExpenseDashboardClient({ rows, currentYear, currentMonth, periods, canExport }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const totalAmount = rows.reduce((s, r) => s + parseFloat(r.totalAmount), 0)

  function handlePeriodChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [y, m] = e.target.value.split('-')
    router.push(`${pathname}?year=${y}&month=${m}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100">
            <Receipt className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard Note Spese</h1>
            <p className="text-sm text-gray-500">Note spese inviate nel periodo selezionato</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            defaultValue={`${currentYear}-${currentMonth}`}
            onChange={handlePeriodChange}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {periods.map((p) => (
              <option key={`${p.year}-${p.month}`} value={`${p.year}-${p.month}`}>{p.label}</option>
            ))}
          </select>
          {canExport && (
            <div className="flex items-center gap-2">
              <a
                href={`/api/finance/export/expenses?year=${currentYear}&month=${currentMonth}`}
                className="flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium
                           text-white hover:bg-teal-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Excel
              </a>
              <a
                href={`/api/finance/export/expenses/pdf?year=${currentYear}&month=${currentMonth}`}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium
                           text-white hover:bg-red-700 transition-colors"
              >
                <FileText className="h-4 w-4" />
                PDF
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-4 space-y-2 bg-teal-50 border border-teal-100">
          <Receipt className="h-5 w-5 text-teal-500" />
          <div className="text-2xl font-bold text-gray-900">{rows.length}</div>
          <div className="text-xs text-gray-500">Note spese inviate</div>
        </div>
        <div className="rounded-xl p-4 space-y-2 bg-teal-50 border border-teal-100">
          <TrendingUp className="h-5 w-5 text-teal-400" />
          <div className="text-2xl font-bold text-gray-900">
            € {totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500">Spese totali</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Utente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Mese competenza</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Data invio</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Stato</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Importo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    Nessuna nota spese inviata in questo periodo.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.reportId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.fullName}</div>
                    <div className="text-xs text-gray-400">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {IT_MONTHS[r.compMonth - 1]} {r.compYear}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm tabular-nums">
                    {r.submittedAt
                      ? new Date(r.submittedAt).toLocaleDateString('it-IT')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/finance/expense/${r.userId}/${r.compYear}/${r.compMonth}`}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-75',
                        STATUS_CLASS[r.status],
                      )}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                      <Eye className="h-3 w-3" />
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 font-medium">
                    € {parseFloat(r.totalAmount).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
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
