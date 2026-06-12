import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getPresignedPutUrl, ALLOWED_MIME_TYPES } from '@/lib/r2'

// Schema legacy (note spese): kind opzionale o assente → comportamento esistente.
// kind='purchase-order' richiede purchaseOrderId; kind='invoice' richiede invoiceId.
const schema = z.discriminatedUnion('kind', [
  z.object({
    kind:        z.literal('expense').optional(),
    filename:    z.string().min(1).max(255),
    contentType: z.enum(ALLOWED_MIME_TYPES),
    year:        z.number().int().min(2020).max(2100),
    month:       z.number().int().min(1).max(12),
  }),
  z.object({
    kind:            z.literal('purchase-order'),
    filename:        z.string().min(1).max(255),
    contentType:     z.enum(ALLOWED_MIME_TYPES),
    purchaseOrderId: z.string().uuid(),
  }),
  z.object({
    kind:        z.literal('invoice'),
    filename:    z.string().min(1).max(255),
    contentType: z.enum(ALLOWED_MIME_TYPES),
    invoiceId:   z.string().uuid(),
  }),
])

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

  let key: string
  if (parsed.data.kind === 'purchase-order') {
    // Solo chi gestisce gli OdA può caricare allegati nella cartella purchase-orders/
    if (!hasSection(session, 'PURCHASE_ORDERS_MANAGE')) {
      return NextResponse.json({ error: 'Non autorizzato.' }, { status: 403 })
    }
    key = `purchase-orders/${parsed.data.purchaseOrderId}/${randomUUID()}.${ext}`
  } else if (parsed.data.kind === 'invoice') {
    // Solo chi gestisce la fatturazione può caricare allegati nella cartella invoices/
    if (!hasSection(session, 'INVOICES_MANAGE')) {
      return NextResponse.json({ error: 'Non autorizzato.' }, { status: 403 })
    }
    key = `invoices/${parsed.data.invoiceId}/${randomUUID()}.${ext}`
  } else {
    // Comportamento esistente per le note spese
    const { year, month } = parsed.data
    const mese = String(month).padStart(2, '0')
    key = `expenses/${session.user.id}/${year}/${mese}/${randomUUID()}.${ext}`
  }

  const url = await getPresignedPutUrl(key, contentType)
  return NextResponse.json({ url, key })
}
