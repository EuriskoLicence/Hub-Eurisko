import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getClientDetail } from '../actions'
import { Building2, FolderOpen, ChevronRight, Users, MapPin, Receipt, Phone } from 'lucide-react'
import { ClientActions } from '@/components/clients/ClientActions'
import { CreateProjectButton } from '@/components/clients/CreateProjectButton'
import { countryName } from '@/components/clients/CountrySelect'
import type { ClientDetail } from '../actions'

type Props = { params: { clientId: string } }

export async function generateMetadata({ params }: Props) {
  return { title: 'Dettaglio cliente' }
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-500 w-40 shrink-0">{label}</span>
      <span className="text-gray-900 break-all">{value}</span>
    </div>
  )
}

function AnagraficaSection({ client }: { client: ClientDetail }) {
  const hasAddress = client.paese || client.indirizzo || client.localita || client.provincia || client.cap
  const hasFiscal  = client.partitaIva || client.codiceDestinatario || client.pec
  const hasContact = client.telefono || client.email || client.terminiPagamento

  if (!hasAddress && !hasFiscal && !hasContact) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      {hasAddress && (
        <div className="px-5 py-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            <MapPin className="h-3.5 w-3.5" />
            Sede
          </div>
          <InfoRow label="Paese"     value={client.paese ? `${client.paese} — ${countryName(client.paese)}` : null} />
          <InfoRow label="Indirizzo" value={client.indirizzo} />
          {(client.localita || client.provincia || client.cap) && (
            <div className="flex gap-2 text-sm">
              <span className="text-gray-500 w-40 shrink-0">Città</span>
              <span className="text-gray-900">
                {[client.localita, client.provincia, client.cap].filter(Boolean).join(' · ')}
              </span>
            </div>
          )}
        </div>
      )}

      {hasFiscal && (
        <div className="px-5 py-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            <Receipt className="h-3.5 w-3.5" />
            Dati fiscali
          </div>
          <InfoRow label="Partita IVA"           value={client.partitaIva} />
          <InfoRow label="Codice Destinatario"   value={client.codiceDestinatario} />
          <InfoRow label="PEC"                   value={client.pec} />
        </div>
      )}

      {hasContact && (
        <div className="px-5 py-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            <Phone className="h-3.5 w-3.5" />
            Contatti e pagamento
          </div>
          <InfoRow label="Telefono"              value={client.telefono} />
          <InfoRow label="Email"                 value={client.email} />
          <InfoRow label="Termini di pagamento"  value={client.terminiPagamento} />
        </div>
      )}
    </div>
  )
}

export default async function ClientDetailPage({ params }: Props) {
  const session = await auth()
  if (!session || !hasSection(session, 'CLIENTS_VIEW')) redirect('/dashboard')

  const canManage = hasSection(session, 'CLIENTS_MANAGE')
  const client = await getClientDetail(params.clientId)
  if (!client) notFound()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <nav className="text-xs text-gray-400 mb-1">
          <Link href="/clients" className="hover:text-gray-600">Clienti</Link>
          {' / '}
          <span className="text-gray-600">{client.name}</span>
        </nav>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100">
              <Building2 className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
                <span className="text-sm font-mono text-gray-400">{client.code}</span>
              </div>
              <p className="text-sm text-gray-500">
                {client.active ? 'Attivo' : 'Inattivo'} · {client.projects.length} progetti
              </p>
            </div>
          </div>
          {canManage && <ClientActions client={client} />}
        </div>
      </div>

      {/* Anagrafica estesa */}
      <AnagraficaSection client={client} />

      {/* Progetti */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Progetti</h2>
          {canManage && client.active && (
            <CreateProjectButton clientId={client.id} />
          )}
        </div>

        {client.projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <FolderOpen className="mx-auto h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Nessun progetto.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {client.projects.map((p) => (
              <Link
                key={p.id}
                href={`/clients/${client.id}/projects/${p.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                  p.active ? 'bg-blue-50' : 'bg-gray-100'
                }`}>
                  <FolderOpen className={`h-4 w-4 ${p.active ? 'text-blue-500' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`font-medium truncate ${p.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                      {p.name}
                    </span>
                    <span className="text-xs font-mono text-gray-400 shrink-0">{p.code}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    {p.responsibleName && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {p.responsibleName}
                      </span>
                    )}
                    <span>{p.engagementCount} commess{p.engagementCount === 1 ? 'a' : 'e'}</span>
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
    </div>
  )
}
