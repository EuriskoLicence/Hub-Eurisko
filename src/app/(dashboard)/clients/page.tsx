import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getClientList } from './actions'
import { Building2, FolderOpen } from 'lucide-react'
import { CreateClientButton } from '@/components/clients/CreateClientButton'
import { ActiveOnlyToggle } from '@/components/ui/ActiveOnlyToggle'
import { ChevronRight } from 'lucide-react'

export const metadata = { title: 'Clienti' }

type Props = { searchParams: { onlyActive?: string } }

export default async function ClientsPage({ searchParams }: Props) {
  const session = await auth()
  if (!session || !hasSection(session, 'CLIENTS_VIEW')) redirect('/dashboard')

  const canManage  = hasSection(session, 'CLIENTS_MANAGE')
  const onlyActive = searchParams.onlyActive === '1'
  const clients    = await getClientList(onlyActive)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100">
            <Building2 className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Clienti</h1>
            <p className="text-sm text-gray-500">Clienti, progetti e commesse</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ActiveOnlyToggle checked={onlyActive} label="Solo attivi" />
          {canManage && <CreateClientButton />}
        </div>
      </div>

      {/* Lista */}
      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Building2 className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">
            {onlyActive ? 'Nessun cliente attivo.' : 'Nessun cliente. Creane uno nuovo!'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                c.active ? 'bg-indigo-50' : 'bg-gray-100'
              }`}>
                <Building2 className={`h-4 w-4 ${c.active ? 'text-indigo-500' : 'text-gray-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`font-medium truncate ${c.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                    {c.name}
                  </span>
                  <span className="text-xs font-mono text-gray-400 shrink-0">{c.code}</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  {c.projectCount} {c.projectCount === 1 ? 'progetto' : 'progetti'}
                </div>
              </div>
              {!c.active && (
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
