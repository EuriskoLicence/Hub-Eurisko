import { cn } from '@/lib/utils'
import type { TimesheetStatus } from '@/types/timesheet'

type Status = TimesheetStatus | 'not_started'

const CONFIG: Record<Status, { label: string; className: string }> = {
  not_started:        { label: 'Non iniziato',      className: 'bg-gray-100 text-gray-600' },
  draft:              { label: 'Bozza',              className: 'bg-yellow-100 text-yellow-700' },
  approved:           { label: 'Inviato',            className: 'bg-green-100 text-green-700' },
  amendment_requested:{ label: 'Rettifica richiesta',className: 'bg-orange-100 text-orange-700' },
  amendment_rejected: { label: 'Rettifica rifiutata',className: 'bg-red-100 text-red-700' },
}

export function StatusBadge({
  status,
  className,
}: {
  status:     Status
  className?: string
}) {
  const { label, className: colorClass } = CONFIG[status] ?? CONFIG.not_started
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        colorClass,
        className,
      )}
    >
      {label}
    </span>
  )
}
