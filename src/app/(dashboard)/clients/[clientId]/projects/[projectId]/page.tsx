import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getProjectDetail, getEngagementTypeOptions, getUserOptions } from '../../../actions'
import { FolderOpen, Users, Tag, Building2 } from 'lucide-react'
import { ProjectActions } from '@/components/clients/ProjectActions'
import { EngagementCard } from '@/components/clients/EngagementCard'
import { CreateEngagementButton } from '@/components/clients/CreateEngagementButton'
import { ActiveOnlyToggle } from '@/components/ui/ActiveOnlyToggle'

type Props = {
  params:       { clientId: string; projectId: string }
  searchParams: { onlyActive?: string }
}

export async function generateMetadata() {
  return { title: 'Dettaglio progetto' }
}

export default async function ProjectDetailPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session || !hasSection(session, 'CLIENTS_VIEW')) redirect('/dashboard')

  const canManage    = hasSection(session, 'CLIENTS_MANAGE')
  const userId       = session.user.id
  const project      = await getProjectDetail(params.projectId)
  if (!project || project.clientId !== params.clientId) notFound()

  const canManageEngs = canManage

  const [engTypes, userOptions] = canManageEngs
    ? await Promise.all([getEngagementTypeOptions(), getUserOptions()])
    : await Promise.all([getEngagementTypeOptions(), Promise.resolve([])])

  const onlyActive   = searchParams.onlyActive === '1'
  const engagements  = onlyActive
    ? project.engagements.filter((e) => e.active)
    : project.engagements

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <nav className="text-xs text-gray-400 mb-1 flex items-center gap-1">
          <Link href="/clients" className="hover:text-gray-600">Clienti</Link>
          <span>/</span>
          <Link href={`/clients/${project.clientId}`} className="hover:text-gray-600">{project.clientName}</Link>
          <span>/</span>
          <span className="text-gray-600">{project.name}</span>
        </nav>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
              <FolderOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
                <span className="text-sm font-mono text-gray-400">{project.code}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {project.clientName}
                </span>
                {project.responsibleName && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {project.responsibleName}
                  </span>
                )}
                <span>{project.active ? 'Attivo' : 'Inattivo'}</span>
              </div>
            </div>
          </div>
          {canManage && (
            <ProjectActions project={project} userOptions={userOptions} />
          )}
        </div>
      </div>

      {/* Commesse */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-800">
            Commesse
            <span className="ml-2 text-sm font-normal text-gray-400">
              ({engagements.length}{onlyActive && project.engagements.length !== engagements.length
                ? ` di ${project.engagements.length}` : ''})
            </span>
          </h2>
          <div className="flex items-center gap-3">
            <ActiveOnlyToggle checked={onlyActive} label="Solo attive" />
            {canManageEngs && project.active && (
              <CreateEngagementButton projectId={project.id} engagementTypes={engTypes} />
            )}
          </div>
        </div>

        {engagements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <Tag className="mx-auto h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">
              {onlyActive ? 'Nessuna commessa attiva.' : 'Nessuna commessa.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {engagements.map((eng) => (
              <EngagementCard
                key={eng.id}
                engagement={eng}
                projectId={project.id}
                clientId={project.clientId}
                canManage={canManageEngs}
                userOptions={userOptions}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
