import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx-js-style'
import { and, eq, ne } from 'drizzle-orm'
import { auth } from '@/auth'
import { handleAuthError, requireSection } from '@/lib/permissions/auth-helpers'
import { db } from '@/db'
import {
  users, timesheetEntries, timesheetMonths,
  absenceTypes,
  roles, roleProfiles, profileSections,
} from '@/db/schema'

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

    // Utenti con sezione TIMESHEET attiva e obbligo di consuntivazione
    // (stessa logica del sollecito: esclude excludeFromTimesheet = true)
    const activeUsers = await db
      .selectDistinct({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users)
      .innerJoin(roles,           eq(roles.id,           users.roleId))
      .innerJoin(roleProfiles,    eq(roleProfiles.roleId, roles.id))
      .innerJoin(profileSections, and(
        eq(profileSections.profileId,   roleProfiles.profileId),
        eq(profileSections.sectionCode, 'TIMESHEET'),
      ))
      .where(and(
        eq(users.active,                true),
        eq(users.excludeFromTimesheet,  false),
      ))
      .orderBy(users.lastName, users.firstName)

    const activeUserIds = activeUsers.map((u) => u.id)

    // Solo entries di assenza del mese
    const entries = await db
      .select({
        userId:           timesheetEntries.userId,
        day:              timesheetEntries.day,
        hours:            timesheetEntries.hours,
        absenceTypeId:        timesheetEntries.absenceTypeId,
        absenceTypeLabel:     absenceTypes.label,
        absenceTypeShortCode: absenceTypes.shortCode,
      })
      .from(timesheetEntries)
      .innerJoin(absenceTypes, eq(timesheetEntries.absenceTypeId, absenceTypes.id))
      .where(
        and(
          eq(timesheetEntries.year,  year),
          eq(timesheetEntries.month, month),
          eq(absenceTypes.partTimeOnly, false),  // esclude voci "Solo PT"
        ),
      )

    // Stato consuntivazione per utente (solo inviati)
    const monthStatuses = await db
      .select({ userId: timesheetMonths.userId, status: timesheetMonths.status })
      .from(timesheetMonths)
      .where(
        and(
          eq(timesheetMonths.year,  year),
          eq(timesheetMonths.month, month),
          ne(timesheetMonths.status, 'draft'),
        ),
      )
    const submittedSet = new Set(monthStatuses.map((r) => r.userId))

    const userMap = new Map(activeUsers.map((u) => [u.id, `${u.lastName} ${u.firstName}`]))

    // Filtra le entries degli utenti con obbligo di consuntivazione E consuntivazione inviata
    const filteredEntries = entries.filter((e) => userMap.has(e.userId) && submittedSet.has(e.userId))

    // ── Build worksheet ────────────────────────────────────────────────────────
    const periodLabel = `${IT_MONTHS[month - 1]} ${year}`

    const headers = [
      'Periodo',
      'Cognome e Nome',
      'Data',
      'Cod.',
      'Voce assenza',
      'Ore',
    ]

    const wsRows = filteredEntries
      .filter((e) => !!e.absenceTypeId)
      .sort((a, b) => {
        const nameA = userMap.get(a.userId) ?? ''
        const nameB = userMap.get(b.userId) ?? ''
        if (nameA !== nameB) return nameA.localeCompare(nameB)
        return a.day - b.day
      })
      .map((e) => {
        const dd = String(e.day).padStart(2, '0')
        const mm = String(month).padStart(2, '0')
        return [
          periodLabel,
          userMap.get(e.userId) ?? '',
          `${dd}/${mm}/${year}`,
          e.absenceTypeShortCode ?? '',
          e.absenceTypeLabel ?? '',
          e.hours,
        ]
      })

    const ws = XLSX.utils.aoa_to_sheet([headers, ...wsRows])

    const headerStyle = {
      font:      { bold: true, color: { rgb: 'FFFFFF' } },
      fill:      { fgColor: { rgb: '374151' } },
      alignment: { horizontal: 'center' },
    }
    for (let c = 0; c < headers.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: 0, c })
      if (ws[ref]) ws[ref].s = headerStyle
    }

    ws['!cols'] = [
      { wch: 16 }, // Periodo
      { wch: 28 }, // Cognome e Nome
      { wch: 12 }, // Data
      { wch: 6  }, // Cod.
      { wch: 24 }, // Voce assenza
      { wch: 6  }, // Ore
    ]

    const label = `${IT_MONTHS[month - 1]}_${year}`
    const wb    = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Assenze')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="assenze_${label}.xlsx"`,
      },
    })
  } catch (err) {
    return handleAuthError(err)
  }
}
