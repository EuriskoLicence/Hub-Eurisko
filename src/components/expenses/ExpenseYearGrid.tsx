'use client'

import Link from 'next/link'
import { CalendarDays, Clock, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExpenseMonthCard } from '@/app/(dashboard)/expenses/actions'

function bestStatus(reports: ExpenseMonthCard['reports']): string {
  if (reports.length === 0) return 'not_started'
  const order = ['draft', 'amendment_requested', 'amendment_rejected', 'submitted', 'approved']
  return reports
    .map((r) => r.status)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))[0]
}

function StatusBadge({ status, count }: { status: string; count: number }) {
  if (status === 'not_started') {
    return <span className="text-sm text-gray-400">Non aperta</span>
  }
  const map: Record<string, { label: string; className: string }> = {
    draft:               { label: 'Bozza',              className: 'bg-amber-100 text-amber-700 border border-amber-200' },
    submitted:           { label: 'Inviata',             className: 'bg-green-100 text-green-700 border border-green-200' },
    approved:            { label: 'Approvata',           className: 'bg-green-100 text-green-700 border border-green-200' },
    amendment_requested: { label: 'Rettifica richiesta', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
    amendment_rejected:  { label: 'Rettifica rifiutata', className: 'bg-red-100 text-red-700 border border-red-200' },
  }
  const s = map[status] ?? map.draft
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', s.className)}>
        {s.label}
      </span>
      {count > 1 && (
        <span className="text-xs text-gray-400">{count} note</span>
      )}
    </div>
  )
}

export function ExpenseYearGrid({ months }: { months: ExpenseMonthCard[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {months.map(({ year, month, monthLabel, reports, isFuture, isCurrent }) => {
        const status     = bestStatus(reports)
        const isDraft    = status === 'draft'
        const isInactive = isFuture && !isCurrent
        const href       = `/expenses/${year}/${month}`

        const totalAmount = reports.reduce((s, r) => s + parseFloat(r.totalAmount || '0'), 0)

        const card = (
          <div
            className={cn(
              'relative rounded-xl border p-4 transition-all',
              isInactive
                ? 'border-gray-100 bg-gray-50 opacity-50 cursor-default'
                : isDraft
                  ? 'border-amber-400 bg-amber-200 hover:bg-amber-300 hover:shadow-sm cursor-pointer'
                  : status === 'submitted' || status === 'approved'
                    ? 'border-green-400 bg-green-200 hover:bg-green-300 hover:shadow-sm cursor-pointer'
                    : status === 'amendment_requested'
                      ? 'border-blue-400 bg-blue-100 hover:bg-blue-200 hover:shadow-sm cursor-pointer'
                      : status === 'amendment_rejected'
                        ? 'border-red-400 bg-red-100 hover:bg-red-200 hover:shadow-sm cursor-pointer'
                        : 'border-gray-200 bg-white hover:shadow-sm cursor-pointer',
            )}
          >
            {/* Icon + label mese/anno */}
            <div className="flex items-center justify-between mb-3">
              {isDraft
                ? <Clock className="h-5 w-5 text-amber-500" />
                : reports.length > 0
                  ? <Receipt className={cn('h-5 w-5', isInactive ? 'text-gray-300' : 'text-green-500')} />
                  : <CalendarDays className={cn('h-5 w-5', isInactive ? 'text-gray-300' : 'text-gray-400')} />
              }
              <span className={cn('text-xs', isInactive ? 'text-gray-300' : 'text-gray-400')}>
                {month}/{year}
              </span>
            </div>

            {/* Nome mese */}
            <p className={cn(
              'font-bold text-base mb-2',
              isInactive ? 'text-gray-300' : 'text-gray-900',
            )}>
              {monthLabel}
            </p>

            {/* Badge stato */}
            {!isInactive && <StatusBadge status={status} count={reports.length} />}

            {/* Totale (se presente) */}
            {!isInactive && totalAmount > 0 && (
              <p className="mt-1 text-xs text-gray-400">
                € {totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </p>
            )}

            {/* Indicatore mese corrente */}
            {isCurrent && (
              <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500" title="Mese corrente" />
            )}
          </div>
        )

        if (isInactive) return <div key={month}>{card}</div>

        return (
          <Link key={month} href={href}>
            {card}
          </Link>
        )
      })}
    </div>
  )
}
