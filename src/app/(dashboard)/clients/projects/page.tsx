import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { db } from '@/db'
import { projects, clients, users, engagements } from '@/db/schema'
import { eq, sql, and } from 'drizzle-orm'
import { FolderOpen, Users, ChevronRight, Building2 } from 'lucide-react'
import { ActiveOnlyToggle } from '@/components/ui/ActiveOnlyToggle'

export const metadata = { title: 'Progetti' }

type Props = { searchParams: { onlyActive?: string } }

export default async function ProjectsListPage({ searchParams }: Props) {
  const session = await auth()
  if (!session || !hasSection(session, 'CLIENTS_VIEW')) redirect('/dashboard')

  const onlyActive = searchParams.onlyActive === '1'

  const where = onlyActive ? eq(projects.active, true) : undefined

  const rows = await db
    .select({
      id:                projects.id,
      name:              projects.name,
      active:            projects.active,
      clientId:          projects.clientId,
      clientName:        clients.name,
      responsibleUserId: projects.responsibleUserId,
      responsibleFirst:  users.firstName,
      responsibleLast:   users.lastName,
      engCount:          sql<number>`cast(count(${engagements.id}) as int)`,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .leftJoin(users, eq(users.id, projects.responsibleUserId))
    .leftJoin(engagements, eq(engagements.projectId, projects.id))
    .where(where)
    .groupBy(projects.id, projects.name, projects.active, projects.clientId, clients.name,
             projects.responsibleUserId, users.firstName, users.lastName)
    .orderBy(clients.name, projects.name)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
            <FolderOpen className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tutti i progetti</h1>
            <p className="text-sm text-gray-500">{rows.length} {rows.length === 1 ? 'progetto' : 'progetti'}</p>
          </div>
        </div>
        <ActiveOnlyToggle checked={onlyActive} label="Solo attivi" />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <FolderOpen className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">
            {onlyActive ? 'Nessun progetto attivo.' : 'Nessun progetto. Creane uno dalla pagina cliente.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/clients/${p.clientId}/projects/${p.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                p.active ? 'bg-blue-50' : 'bg-gray-100'
              }`}>
                <FolderOpen className={`h-4 w-4 ${p.active ? 'text-blue-500' : 'text-gray-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-medium truncate ${p.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                  {p.name}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {p.clientName}
                  </span>
                  {p.responsibleFirst && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {p.responsibleFirst} {p.responsibleLast}
                    </span>
                  )}
                  <span>{Number(p.engCount)} commess{Number(p.engCount) === 1 ? 'a' : 'e'}</span>
                </div>
              </div>
              {!p.active && (
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">Inattivo</span>
              )}
              <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
