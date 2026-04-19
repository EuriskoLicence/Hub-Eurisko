import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { auth } from '@/auth'
import { getPresignedPutUrl, ALLOWED_MIME_TYPES } from '@/lib/r2'

const schema = z.object({
  filename:    z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_MIME_TYPES),
})

// Rate limiting semplice in memoria (max 20 req/min per IP)
const ipCounters = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now  = Date.now()
  const data = ipCounters.get(ip)

  if (!data || now > data.resetAt) {
    ipCounters.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (data.count >= 20) return false
  data.count++
  return true
}

export async function POST(req: NextRequest) {
  // Auth
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Rate limit
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Troppe richieste. Riprova tra un minuto.' }, { status: 429 })
  }

  // Validazione body
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body non valido.' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Tipo file non supportato o nome file mancante.' }, { status: 400 })
  }

  const { filename, contentType } = parsed.data
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'bin'
  // Chiave: expenses/{userId}/{uuid}.{ext}
  const key = `expenses/${session.user.id}/${randomUUID()}.${ext}`

  const url = await getPresignedPutUrl(key, contentType)
  return NextResponse.json({ url, key })
}
