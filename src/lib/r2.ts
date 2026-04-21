import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/** Client R2 (S3-compatible) — configurato una volta sola a livello di modulo */
const r2 = new S3Client({
  region:   'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!

/**
 * Genera una presigned PUT URL per l'upload diretto dal browser.
 * Scadenza default: 5 minuti.
 */
export async function getPresignedPutUrl(
  key:         string,
  contentType: string,
  expiresIn =  300,
): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType })
  return getSignedUrl(r2, cmd, { expiresIn })
}

/**
 * Genera una presigned GET URL per la visualizzazione di un allegato.
 * Scadenza default: 1 ora.
 */
export async function getPresignedGetUrl(
  key:       string,
  expiresIn = 3600,
): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(r2, cmd, { expiresIn })
}

/**
 * Elimina un oggetto dal bucket R2.
 */
export async function deleteObject(key: string): Promise<void> {
  const cmd = new DeleteObjectCommand({ Bucket: BUCKET, Key: key })
  await r2.send(cmd)
}

/** Tipi MIME accettati per gli allegati nota spese */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

/** Dimensione massima allegato: 10 MB */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
