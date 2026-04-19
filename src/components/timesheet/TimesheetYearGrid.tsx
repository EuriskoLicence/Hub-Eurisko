'use client'

import Link from 'next/link'
import { CalendarDays, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

type MonthData = {
  year:       number
  month:      number
  monthLabel: string
  status:     'not_started' | 'draft' | 'approved' | 'amendment_requested' | 'amendment_rejected'
  totalHours: number
  isCurrent:  boolean
  isFuture:   boolean
}

function StatusBadge({ status }: { status: MonthData['status'] }) {
  if (status === 'not_started') {
    return <span className="text-sm text-gray-400">Non aperto</span>
  }
  const map: Record<string, { label: string; className: string }> = {
    draft:                { label: 'Bozza',           className: 'bg-amber-100 text-amber-700 border border-amber-200' },
    approved:            { label: 'Inviato',          className: 'bg-green-100 text-green-700 border border-green-200' },
    amendment_requested:  { label: 'Rettifica richiesta', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
    amendment_rejected:   { label: 'Rettifica rifiutata', className: 'bg-red-100 text-red-700 border border-red-200' },
  }
  const s = map[status] ?? map.draft
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', s.className)}>
      {s.label}
    </span>
  )
}

export function TimesheetYearGrid({ months, year, basePath = '/timesheet' }: { months: MonthData[]; year: number; basePath?: string }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {months.map(({ month, monthLabel, status, totalHours, isCurrent, isFuture }) => {
        const isDraft    = status === 'draft'
        const isInactive = isFuture && !isCurrent

        const card = (
          <div
            className={cn(
              'relative rounded-xl border-2 p-4 transition-all',
              isInactive
                ? 'border-gray-100 bg-gray-50 opacity-50 cursor-default'
                : isDraft
                  ? 'border-amber-400 bg-amber-200 hover:bg-amber-300 hover:shadow-sm cursor-pointer'
                  : status === 'approved'
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
                ? <Clock className="h-5 w-5 text-amber-600" />
                : status === 'approved'
                  ? <CalendarDays className="h-5 w-5 text-green-600" />
                  : status === 'amendment_requested'
                    ? <CalendarDays className="h-5 w-5 text-blue-500" />
                    : status === 'amendment_rejected'
                      ? <CalendarDays className="h-5 w-5 text-red-500" />
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
            {!isInactive && <StatusBadge status={status} />}

            {/* Ore (se presenti) */}
            {!isInactive && totalHours > 0 && (
              <p className="mt-1 text-xs text-gray-400">{totalHours}h inserite</p>
            )}

            {/* Indicatore mese corrente */}
            {isCurrent && (
              <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500" title="Mese corrente" />
            )}
          </div>
        )

        if (isInactive) return <div key={month}>{card}</div>

        return (
          <Link key={month} href={`${basePath}/${year}/${month}`}>
            {card}
          </Link>
        )
      })}
    </div>
  )
}
