'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  onClose:   () => void
  onConfirm: (reason: string) => Promise<void>
  title?:    string
}

/**
 * Modale per la richiesta di rettifica consuntivazione.
 * Il motivo è obbligatorio.
 */
export function AmendmentModal({
  onClose,
  onConfirm,
  title = 'Richiedi rettifica',
}: Props) {
  const [reason, setReason]   = useState('')
  const [error,  setError]    = useState('')
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    if (!reason.trim()) {
      setError('Il motivo è obbligatorio.')
      return
    }
    setError('')
    startTransition(async () => {
      await onConfirm(reason.trim())
    })
  }

  return (
    // Overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            Inserisci il motivo per cui stai richiedendo la rettifica della consuntivazione.
            Verrà inviata una notifica all'ufficio HR Finance.
          </p>

          <div>
            <label htmlFor="amendment-reason" className="block text-sm font-medium text-gray-700 mb-1.5">
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea
              id="amendment-reason"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError('') }}
              rows={4}
              placeholder="Descrivi la modifica necessaria…"
              className={cn(
                'w-full resize-none rounded-lg border px-3.5 py-2.5 text-sm text-gray-900',
                'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500',
                'focus:border-transparent transition-colors',
                error ? 'border-red-400' : 'border-gray-300',
              )}
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700
                       hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || !reason.trim()}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white
                       hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Invio…' : 'Invia richiesta'}
          </button>
        </div>
      </div>
    </div>
  )
}
