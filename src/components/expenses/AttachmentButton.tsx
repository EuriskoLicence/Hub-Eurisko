'use client'

import { useRef, useState } from 'react'
import { Paperclip, CheckCircle2, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/r2'

type Props = {
  attachmentKey:      string | null
  attachmentFilename: string | null
  requiresAttachment: boolean
  disabled?:          boolean
  onUploaded: (key: string, filename: string) => void
  onRemoved:  () => void
}

/**
 * Pulsante con icona per caricare/visualizzare/rimuovere un allegato.
 * Gestisce il flusso: richiesta presigned PUT URL → upload diretto su R2.
 */
export function AttachmentButton({
  attachmentKey,
  attachmentFilename,
  requiresAttachment,
  disabled,
  onUploaded,
  onRemoved,
}: Props) {
  const inputRef           = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState('')

  const hasFile = !!attachmentKey

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')

    if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
      setError('Tipo non supportato. Carica PDF, JPG, PNG o WEBP.')
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('File troppo grande (max 10 MB).')
      return
    }

    setUploading(true)
    try {
      // 1. Richiede presigned PUT URL
      const res = await fetch('/api/upload/presigned-url', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ filename: file.name, contentType: file.type }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Errore nella richiesta URL di upload.')
      }

      const { url, key } = await res.json()

      // 2. Upload diretto su R2
      const uploadRes = await fetch(url, {
        method:  'PUT',
        headers: { 'Content-Type': file.type },
        body:    file,
      })

      if (!uploadRes.ok) throw new Error('Upload fallito. Riprova.')

      onUploaded(key, file.name)
    } catch (err: any) {
      setError(err.message ?? 'Errore imprevisto.')
    } finally {
      setUploading(false)
      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleViewAttachment() {
    if (!attachmentKey) return
    window.open(`/api/attachments/${encodeURIComponent(attachmentKey)}`, '_blank')
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1.5">
        {/* Indicator */}
        {requiresAttachment ? (
          <span className={cn(
            'text-[10px] font-medium',
            hasFile ? 'text-green-600' : 'text-red-500',
          )}>
            {hasFile ? '✓ Allegato' : '* Obbligatorio'}
          </span>
        ) : (
          <span className="text-[10px] text-gray-400">Facoltativo</span>
        )}

        {/* Pulsante allegato */}
        {hasFile ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleViewAttachment}
              title={attachmentFilename ?? 'Visualizza allegato'}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium
                         text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span className="max-w-[80px] truncate">{attachmentFilename}</span>
            </button>
            {!disabled && (
              <button
                type="button"
                onClick={onRemoved}
                className="rounded p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                title="Rimuovi allegato"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ) : uploading ? (
          <span className="flex items-center gap-1 text-[11px] text-blue-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            Upload…
          </span>
        ) : (
          !disabled && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              title="Carica allegato (PDF, JPG, PNG — max 10MB)"
              className={cn(
                'rounded p-0.5 transition-colors',
                requiresAttachment
                  ? 'text-red-400 hover:text-red-600 hover:bg-red-50'
                  : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100',
              )}
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
          )
        )}
      </div>

      {error && <p className="text-[10px] text-red-600 max-w-[150px]">{error}</p>}

      {/* Input file nascosto */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
