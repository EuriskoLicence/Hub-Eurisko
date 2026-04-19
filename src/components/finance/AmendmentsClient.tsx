'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Clock, FileText, Receipt, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { reviewTimesheetAmendment, reviewExpenseAmendment } from '@/app/(dashboard)/finance/actions'
import type { AmendmentRow } from '@/app/(dashboard)/finance/actions'

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

type Props = { amendments: AmendmentRow[] }

export function AmendmentsClient({ amendments }: Props) {
  if (amendments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-300 mb-3" />
        <p className="text-sm text-gray-500">Nessuna rettifica in attesa. Tutto in ordine!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {amendments.map((a) => (
        <AmendmentCard key={`${a.type}-${a.id}`} amendment={a} />
      ))}
    </div>
  )
}

function AmendmentCard({ amendment: a }: { amendment: AmendmentRow }) {
  const router = useRouter()
  const [expanded,        setExpanded]        = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showReject,      setShowReject]       = useState(false)
  const [error,           setError]            = useState('')
  const [isPending,       startTransition]     = useTransition()

  const monthLabel = `${IT_MONTHS[a.month - 1]} ${a.year}`
  const dateLabel  = new Date(a.requestedAt).toLocaleDateString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  async function handleApprove() {
    setError('')
    startTransition(async () => {
      const res = a.type === 'timesheet'
        ? await reviewTimesheetAmendment(a.id, 'approve')
        : await reviewExpenseAmendment(a.id, 'approve')
      if (res.ok) router.refresh()
      else setError(res.error)
    })
  }

  async function handleReject() {
    if (!rejectionReason.trim()) { setError('Il motivo del rifiuto è obbligatorio.'); return }
    setError('')
    startTransition(async () => {
      const res = a.type === 'timesheet'
        ? await reviewTimesheetAmendment(a.id, 'reject', rejectionReason)
        : await reviewExpenseAmendment(a.id, 'reject', rejectionReason)
      if (res.ok) { setShowReject(false); router.refresh() }
      else setError(res.error)
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
          a.type === 'timesheet' ? 'bg-blue-50' : 'bg-green-50',
        )}>
          {a.type === 'timesheet'
            ? <FileText className="h-4 w-4 text-blue-500" />
            : <Receipt className="h-4 w-4 text-green-500" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">{a.fullName}</span>
            <span className={cn(
              'text-xs rounded-full px-2 py-0.5 font-medium shrink-0',
              a.type === 'timesheet' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700',
            )}>
              {a.type === 'timesheet' ? 'Consuntivazione' : 'Nota spese'}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
            <span>{monthLabel}</span>
            {a.title && <><span>·</span><span className="truncate max-w-[150px]">{a.title}</span></>}
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {dateLabel}
            </span>
          </div>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-gray-400 shrink-0 transition-transform', expanded && 'rotate-180')} />
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Motivo della richiesta</p>
            <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2">{a.reason || '—'}</p>
          </div>

          {!showReject ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowReject(true)}
                disabled={isPending}
                className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm
                           font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Rifiuta
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isPending}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm
                           font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isPending ? 'Elaborazione…' : 'Approva (torna in bozza)'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Motivo del rifiuto <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => { setRejectionReason(e.target.value); setError('') }}
                  rows={3}
                  placeholder="Spiega perché la rettifica viene rifiutata…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowReject(false); setRejectionReason(''); setError('') }}
                  disabled={isPending}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium
                             text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isPending || !rejectionReason.trim()}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white
                             hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? 'Elaborazione…' : 'Conferma rifiuto'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
