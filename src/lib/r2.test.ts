/**
 * Test suite per src/lib/r2.ts
 *
 * Copre i valori esportati senza invocare AWS SDK / rete:
 *  - ALLOWED_MIME_TYPES: contenuto e unicità
 *  - MAX_FILE_SIZE_BYTES: valore atteso (10 MB)
 *  - Logica di validazione simulata (stessa che usa AttachmentButton)
 */

import { describe, it, expect } from 'vitest'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from './r2'

// ─── Costanti ─────────────────────────────────────────────────────────────────

describe('ALLOWED_MIME_TYPES', () => {
  it('include i tipi immagine standard', () => {
    expect(ALLOWED_MIME_TYPES).toContain('image/jpeg')
    expect(ALLOWED_MIME_TYPES).toContain('image/png')
    expect(ALLOWED_MIME_TYPES).toContain('image/webp')
  })

  it('include application/pdf', () => {
    expect(ALLOWED_MIME_TYPES).toContain('application/pdf')
  })

  it('non contiene duplicati', () => {
    const unique = new Set(ALLOWED_MIME_TYPES)
    expect(unique.size).toBe(ALLOWED_MIME_TYPES.length)
  })

  it('non include tipi pericolosi (eseguibili, script)', () => {
    const forbidden = ['application/octet-stream', 'text/html', 'application/javascript', 'image/svg+xml']
    for (const t of forbidden) {
      expect(ALLOWED_MIME_TYPES).not.toContain(t)
    }
  })

  it('contiene esattamente 4 tipi', () => {
    expect(ALLOWED_MIME_TYPES).toHaveLength(4)
  })
})

describe('MAX_FILE_SIZE_BYTES', () => {
  it('è esattamente 10 MB (10 * 1024 * 1024)', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024)
  })

  it('è maggiore di 1 MB', () => {
    expect(MAX_FILE_SIZE_BYTES).toBeGreaterThan(1024 * 1024)
  })

  it('non supera 50 MB (ragionevole per allegati spese)', () => {
    expect(MAX_FILE_SIZE_BYTES).toBeLessThanOrEqual(50 * 1024 * 1024)
  })
})

// ─── Logica di validazione file (simulata dal client) ─────────────────────────

describe('validazione file (ALLOWED_MIME_TYPES + MAX_FILE_SIZE_BYTES)', () => {
  function validateFile(type: string, sizeBytes: number): { ok: boolean; error?: string } {
    if (!ALLOWED_MIME_TYPES.includes(type as any)) {
      return { ok: false, error: 'Tipo non supportato.' }
    }
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      return { ok: false, error: 'File troppo grande.' }
    }
    return { ok: true }
  }

  it('accetta un PDF entro il limite', () => {
    expect(validateFile('application/pdf', 5 * 1024 * 1024)).toEqual({ ok: true })
  })

  it('accetta un JPEG entro il limite', () => {
    expect(validateFile('image/jpeg', 1024)).toEqual({ ok: true })
  })

  it('rifiuta un tipo non supportato', () => {
    const result = validateFile('application/zip', 1024)
    expect(result.ok).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('rifiuta un file troppo grande (>10 MB)', () => {
    const result = validateFile('image/png', MAX_FILE_SIZE_BYTES + 1)
    expect(result.ok).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('accetta un file esattamente al limite (10 MB)', () => {
    expect(validateFile('image/jpeg', MAX_FILE_SIZE_BYTES)).toEqual({ ok: true })
  })

  it('rifiuta un file di 0 byte con tipo non supportato', () => {
    const result = validateFile('text/plain', 0)
    expect(result.ok).toBe(false)
  })

  it('accetta tutti i tipi permessi', () => {
    for (const mime of ALLOWED_MIME_TYPES) {
      expect(validateFile(mime, 1024).ok).toBe(true)
    }
  })
})
