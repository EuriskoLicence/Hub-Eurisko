import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { handleAuthError, requireSection } from '@/lib/permissions/auth-helpers'
import { getUsersWithoutSubmittedTimesheet } from '@/app/(dashboard)/finance/actions'
import { sendTimesheetReminderEmail } from '@/lib/email'

// Resend ha un limite di 5 richieste/secondo.
// Con batch da 5 + 1s di pausa: 34 utenti ≈ 8s, entro i 10s del piano Hobby Vercel.
const BATCH_SIZE  = 5
const BATCH_DELAY = 1050  // ms — leggermente sopra 1s per non sfiorare il limite

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    requireSection(session, 'FINANCE_DASHBOARD')

    const body = await req.json().catch(() => ({}))
    const year  = parseInt(body.year  ?? '')
    const month = parseInt(body.month ?? '')

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Parametri non validi.' }, { status: 400 })
    }

    const missing = await getUsersWithoutSubmittedTimesheet(year, month)

    if (missing.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    // Invio a batch da 5 con 1 secondo di pausa tra i batch
    // per rispettare il rate limit di Resend (max 5 req/s)
    const batches = chunk(missing, BATCH_SIZE)
    let sent = 0

    for (let i = 0; i < batches.length; i++) {
      const results = await Promise.allSettled(
        batches[i].map((u) =>
          sendTimesheetReminderEmail({
            userEmail: u.email,
            userName:  u.fullName,
            year,
            month,
          }),
        ),
      )
      sent += results.filter((r) => r.status === 'fulfilled').length

      // Pausa tra batch, tranne dopo l'ultimo
      if (i < batches.length - 1) await sleep(BATCH_DELAY)
    }

    return NextResponse.json({ ok: true, sent })
  } catch (err) {
    return handleAuthError(err)
  }
}
