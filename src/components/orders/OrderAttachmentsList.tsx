'use client'

import { useRef, useState } from 'react'
import { Paperclip, X, Loader2, FileText, Image as ImageIcon, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/r2'
import imageCompression from 'browser-image-compression'

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

async function prepareFile(file: File): Promise<File> {
  if (!IMAGE_MIME_TYPES.includes(file.type)) return file
  return imageCompression(file, {
    maxSizeMB:           1,
    maxWidthOrHeight:    1920,
    useWebWorker:        true,
    fileType:            file.type as any,
  })
}

export type AttachmentItem = { id?: string; key: string; filename: string }

type Props = {
  /** id dell'OdA (UUID generato client-side prima del salvataggio o id reale dopo). Usato come prefisso R2. */
  purchaseOrderId: string
  attachments:     AttachmentItem[]
  disabled?:       boolean
  /** chiamata a upload completato (R2 OK). Per OdA esistente, il chiamante salva anche su DB. */
  onUploaded:      (att: AttachmentItem) => void
  /** chiamata a rimozione locale. Per OdA esistente, il chiamante elimina anche su DB. */
  onRemoved:       (att: AttachmentItem) => void
  /** Se true, blocca l'eliminazione dell'ultimo allegato (vincolo OdA: almeno 1). */
  enforceMinOne?:  boolean
}

export function OrderAttachmentsList({ purchaseOrderId, attachments, disabled, onUploaded, onRemoved, enforceMinOne = true }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError('')

    for (const original of Array.from(files)) {
      // Validazioni
      if (!ALLOWED_MIME_TYPES.includes(original.type as any)) {
        setError(`Tipo file non supportato: ${original.name}`)
        continue
      }
      if (original.size > MAX_FILE_SIZE_BYTES) {
        setError(`File troppo grande (max 10MB): ${original.name}`)
        continue
      }

      setUploading(true)
      try {
        const file = await prepareFile(original)

        const presignRes = await fetch('/api/upload/presigned-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind:            'purchase-order',
            filename:        original.name,
            contentType:     file.type,
            purchaseOrderId,
          }),
        })
        if (!presignRes.ok) {
          const body = await presignRes.json().catch(() => ({}))
          throw new Error(body.error ?? `HTTP ${presignRes.status}`)
        }
        const { url, key } = await presignRes.json()

        const putRes = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
        if (!putRes.ok) throw new Error('Upload fallito')

        onUploaded({ key, filename: original.name })
      } catch (e: any) {
        setError(e?.message ?? 'Errore upload')
      } finally {
        setUploading(false)
      }
    }

    if (inputRef.current) inputRef.current.value = ''
  }

  function isImage(filename: string) {
    return /\.(png|jpe?g|webp|gif)$/i.test(filename)
  }

  async function handleRemove(att: AttachmentItem) {
    if (enforceMinOne && attachments.length <= 1) {
      setError('L\'OdA deve avere almeno un allegato.')
      return
    }
    setError('')
    onRemoved(att)
  }

  return (
    <div className="space-y-2">
      {/* Lista allegati */}
      <div className="space-y-1.5">
        {attachments.map((a, i) => (
          <div key={a.key} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-gray-50 shrink-0">
              {isImage(a.filename)
                ? <ImageIcon className="h-3.5 w-3.5 text-gray-400" />
                : <FileText  className="h-3.5 w-3.5 text-gray-400" />
              }
            </div>
            <a
              href={`/api/attachments/${a.key.split('/').map(encodeURIComponent).join('/')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-0 truncate text-gray-700 hover:text-blue-600 hover:underline"
              title={a.filename}
            >
              {a.filename}
            </a>
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(a)}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Rimuovi"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Pulsante upload */}
      {!disabled && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_MIME_TYPES.join(',')}
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              'flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50',
            )}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {uploading ? 'Caricamento…' : (attachments.length === 0 ? 'Aggiungi allegato' : 'Aggiungi altro allegato')}
          </button>
          <p className="mt-1 text-xs text-gray-400">
            <Paperclip className="inline h-3 w-3 mr-1" />
            PDF / immagini · max 10MB · almeno 1 allegato richiesto
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
    </div>
  )
}
