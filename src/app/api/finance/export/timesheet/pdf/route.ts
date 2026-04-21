import { NextRequest, NextResponse } from 'next/server'
import { and, eq, ne } from 'drizzle-orm'
import { auth } from '@/auth'
import { handleAuthError, requireSection } from '@/lib/permissions/auth-helpers'
import { db } from '@/db'
import {
  users, timesheetEntries, timesheetMonths,
  absenceTypes, roles, roleProfiles, profileSections,
} from '@/db/schema'
import { generatePdfTable } from '@/lib/pdf-table'

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    requireSection(session, 'FINANCE_EXPORT')

    const { searchParams } = req.nextUrl
    const year  = parseInt(searchParams.get('year')  ?? '')
    const month = parseInt(searchParams.get('month') ?? '')

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Parametri non validi.' }, { status: 400 })
    }

    const activeUsers = await db
      .selectDistinct({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .innerJoin(roles,           eq(roles.id,           users.roleId))
      .innerJoin(roleProfiles,    eq(roleProfiles.roleId, roles.id))
      .innerJoin(profileSections, and(
        eq(profileSections.profileId,   roleProfiles.profileId),
        eq(profileSections.sectionCode, 'TIMESHEET'),
      ))
      .where(eq(users.active, true))

    const monthStatuses = await db
      .select({ userId: timesheetMonths.userId })
      .from(timesheetMonths)
      .where(and(
        eq(timesheetMonths.year,  year),
        eq(timesheetMonths.month, month),
        ne(timesheetMonths.status, 'draft'),
      ))
    const submittedSet = new Set(monthStatuses.map((r) => r.userId))

    const entries = await db
      .select({
        userId:           timesheetEntries.userId,
        day:              timesheetEntries.day,
        hours:            timesheetEntries.hours,
        absenceTypeLabel:     absenceTypes.label,
        absenceTypeShortCode: absenceTypes.shortCode,
      })
      .from(timesheetEntries)
      .innerJoin(absenceTypes, eq(timesheetEntries.absenceTypeId, absenceTypes.id))
      .where(and(eq(timesheetEntries.year, year), eq(timesheetEntries.month, month)))

    const userNameMap = new Map(activeUsers.map((u) => [u.id, `${u.lastName} ${u.firstName}`]))
    const periodLabel = `${IT_MONTHS[month - 1]} ${year}`

    const rows = entries
      .filter((e) => submittedSet.has(e.userId))
      .sort((a, b) => {
        const nameA = userNameMap.get(a.userId) ?? ''
        const nameB = userNameMap.get(b.userId) ?? ''
        if (nameA !== nameB) return nameA.localeCompare(nameB)
        return a.day - b.day
      })
      .map((e) => {
        const dd = String(e.day).padStart(2, '0')
        const mm = String(month).padStart(2, '0')
        return [periodLabel, userNameMap.get(e.userId) ?? '', `${dd}/${mm}/${year}`, e.absenceTypeShortCode ?? '', e.absenceTypeLabel ?? '', e.hours]
      })

    const buffer = await generatePdfTable({
      title:   `Assenze — ${periodLabel}`,
      columns: [
        { header: 'Periodo',        width: 80  },
        { header: 'Cognome e Nome', width: 140 },
        { header: 'Data',           width: 65  },
        { header: 'Cod.',           width: 30  },
        { header: 'Voce assenza',   width: 120 },
        { header: 'Ore',            width: 35, align: 'right' },
      ],
      rows,
    })

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="assenze_${IT_MONTHS[month - 1]}_${year}.pdf"`,
      },
    })
  } catch (err) {
    return handleAuthError(err)
  }
}
