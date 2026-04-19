import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { handleAuthError, requireSection } from '@/lib/permissions/auth-helpers'
import { getUsersWithoutSubmittedTimesheet } from '@/app/(dashboard)/finance/actions'
import { sendTimesheetReminderEmail } from '@/lib/email'

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

    // Fire & forget — send all in parallel, don't await
    await Promise.allSettled(
      missing.map((u) =>
        sendTimesheetReminderEmail({
          userEmail: u.email,
          userName:  u.fullName,
          year,
          month,
        }),
      ),
    )

    return NextResponse.json({ ok: true, sent: missing.length })
  } catch (err) {
    return handleAuthError(err)
  }
}
