import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getHoursReport } from '../../actions'
import { generatePdfTable } from '@/lib/pdf-table'

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !hasSection(session, 'CLIENTS_VIEW')) {
    return new NextResponse('Non autorizzato', { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const year          = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month         = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
  const responsibleId = searchParams.get('responsibleId') || null
  const clientId      = searchParams.get('clientId')      || null
  const projectId     = searchParams.get('projectId')     || null
  const engagementId  = searchParams.get('engagementId')  || null
  const userId        = searchParams.get('userId')        || null

  const rows = await getHoursReport({ year, month, responsibleId, clientId, projectId, engagementId, userId })

  const periodo      = month ? `${IT_MONTHS[month - 1]} ${year}` : `Anno ${year}`
  const periodoLabel = (m: number | null, y: number) => m ? `${IT_MONTHS[m - 1]} ${y}` : `Anno ${y}`

  const dataRows: (string | number)[][] = []
  for (const eng of rows) {
    for (const u of eng.users) {
      dataRows.push([
        eng.clientName,
        eng.projectName,
        eng.projectManagerName,
        eng.engagementName,
        eng.compositeCode,
        u.userName,
        periodoLabel(month, year),
        u.standardHours,
        u.extraHours,
        u.totalHours,
      ])
    }
  }

  const buffer = await generatePdfTable({
    title:   `Report ore per commessa — ${periodo}`,
    columns: [
      { header: 'Cliente',      width: 90  },
      { header: 'Progetto',     width: 100 },
      { header: 'Responsabile', width: 90  },
      { header: 'Commessa',     width: 100 },
      { header: 'Codice',       width: 60  },
      { header: 'Persona',      width: 90  },
      { header: 'Periodo',      width: 70  },
      { header: 'Ore std',      width: 45, align: 'right' },
      { header: 'Ore extra',    width: 50, align: 'right' },
      { header: 'Totale',       width: 45, align: 'right' },
    ],
    rows: dataRows,
  })

  const filename = month
    ? `report-ore-${IT_MONTHS[month - 1].toLowerCase()}-${year}.pdf`
    : `report-ore-${year}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
