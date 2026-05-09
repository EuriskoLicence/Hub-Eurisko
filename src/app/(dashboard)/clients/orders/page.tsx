import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { ShoppingCart, Plus, ChevronRight, Building2, User, Euro, Calendar, AlertTriangle, Paperclip } from 'lucide-react'
import { getPurchaseOrders, getResponsibleCandidates } from './actions'
import { getClientList } from '../actions'
import { ResponsibleFilter } from '@/components/ui/ResponsibleFilter'
import { ClientFilterSelect } from '@/components/ui/ClientFilterSelect'
import { OnlyOpenToggle } from '@/components/ui/OnlyOpenToggle'

export const metadata = { title: 'Ordini di Acquisto' }

type Props = { searchParams: { clientId?: string; responsibleId?: string; onlyOpen?: string } }

export default async function PurchaseOrdersListPage({ searchParams }: Props) {
  const session = await auth()
  if (!session || !hasSection(session, 'PURCHASE_ORDERS_VIEW')) redirect('/dashboard')

  const canManage = hasSection(session, 'PURCHASE_ORDERS_MANAGE')

  const [orders, clientsList, responsibles] = await Promise.all([
    getPurchaseOrders({
      clientId:      searchParams.clientId,
      responsibleId: searchParams.responsibleId,
      onlyOpen:      searchParams.onlyOpen === '1',
    }),
    getClientList(true),
    getResponsibleCandidates(),
  ])

  const openCount = orders.filter((o) => !o.hasPositions).length

  function fmtEur(s: string) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(s))
  }
  function fmtDate(s: string) {
    return new Date(s + 'T00:00:00').toLocaleDateString('it-IT')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
            <ShoppingCart className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ordini di Acquisto</h1>
            <p className="text-sm text-gray-500">{orders.length} {orders.length === 1 ? 'ordine' : 'ordini'}{openCount > 0 ? ` · ${openCount} senza posizioni` : ''}</p>
          </div>
        </div>
        {canManage && (
          <Link
            href="/clients/orders/new"
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            Nuovo OdA
          </Link>
        )}
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Cliente</label>
          <ClientFilterSelect clients={clientsList.map((c) => ({ id: c.id, name: c.name }))} value={searchParams.clientId ?? ''} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Responsabile</label>
          <ResponsibleFilter
            options={responsibles.map((r) => ({ id: r.id, name: r.name }))}
            value={searchParams.responsibleId ?? ''}
          />
        </div>
        <OnlyOpenToggle checked={searchParams.onlyOpen === '1'} />
      </div>

      {/* Lista */}
      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <ShoppingCart className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Nessun ordine di acquisto.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/clients/orders/${o.id}`}
              className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 shrink-0">
                <ShoppingCart className="h-4 w-4 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-semibold text-gray-900">{o.code}</span>
                  <span className="text-sm text-gray-500">·</span>
                  <span className="text-sm text-gray-700">N. {o.number}</span>
                  {o.needsReview && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-medium text-red-700">
                      <AlertTriangle className="h-3 w-3" />
                      Da rivedere
                    </span>
                  )}
                  {!o.hasPositions && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      Senza posizioni
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                  <span className="flex items-center gap-1"><Calendar  className="h-3 w-3" />{fmtDate(o.date)}</span>
                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{o.clientName}</span>
                  <span className="flex items-center gap-1"><User      className="h-3 w-3" />{o.responsibleName}</span>
                  <span className="flex items-center gap-1"><Euro      className="h-3 w-3" />{fmtEur(o.totalAmount)}</span>
                  <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />{o.attachmentsCount}</span>
                  <span>{o.positionsCount} posizion{o.positionsCount === 1 ? 'e' : 'i'}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 mt-1 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

