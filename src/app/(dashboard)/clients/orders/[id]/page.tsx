import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { ShoppingCart, ChevronLeft, AlertTriangle, Building2, Calendar, Hash, User, FileText, Mail } from 'lucide-react'
import {
  getPurchaseOrderDetail,
  getResponsibleCandidates,
  getOpenEngagementsForClient,
  getReferencedInactiveEngagementsForOrder,
  getPurchaseOrderLineStatusOptions,
} from '../actions'
import { OrderHeaderEdit }       from '@/components/orders/OrderHeaderEdit'
import { OrderAttachmentsManager } from '@/components/orders/OrderAttachmentsManager'
import { OrderLinesGrid }        from '@/components/orders/OrderLinesGrid'

type Props = { params: { id: string } }

export const metadata = { title: 'Dettaglio OdA' }

export default async function PurchaseOrderDetailPage({ params }: Props) {
  const session = await auth()
  if (!session || !hasSection(session, 'PURCHASE_ORDERS_VIEW')) redirect('/dashboard')
  const canManage = hasSection(session, 'PURCHASE_ORDERS_MANAGE')

  const po = await getPurchaseOrderDetail(params.id)
  if (!po) notFound()

  const [responsibles, openEngagements, inactiveEngagements, lineStatuses] = await Promise.all([
    getResponsibleCandidates(),
    getOpenEngagementsForClient(po.clientId),
    getReferencedInactiveEngagementsForOrder(po.id),
    getPurchaseOrderLineStatusOptions(),
  ])

  // Merge: opzioni selezionabili + commesse storiche inattive (marcate inactive)
  const engagements = [
    ...openEngagements.map((e) => ({ ...e, inactive: false })),
    ...inactiveEngagements,
  ]

  function fmtEur(s: string) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(s))
  }
  function fmtDate(s: string) {
    return new Date(s + 'T00:00:00').toLocaleDateString('it-IT')
  }

  const linesSum = po.lines.reduce((s, l) => s + Number(l.amount), 0)
  const totalNum = Number(po.totalAmount)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 flex items-center gap-1">
        <Link href="/clients/orders" className="hover:text-gray-600 flex items-center gap-1">
          <ChevronLeft className="h-3 w-3" />
          Ordini di Acquisto
        </Link>
        <span>/</span>
        <span className="text-gray-600">{po.code}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
            <ShoppingCart className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 font-mono">{po.code}</h1>
              <span className="text-sm text-gray-500">N. {po.number}</span>
              {po.needsReview && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-medium text-red-700">
                  <AlertTriangle className="h-3 w-3" />
                  Da rivedere
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Ordine di Acquisto</p>
          </div>
        </div>
      </div>

      {/* Banner "da rivedere" */}
      {po.needsReview && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <div className="text-sm text-red-800">
            <p className="font-semibold">L'importo totale è stato modificato.</p>
            <p>
              La somma delle posizioni ({fmtEur(String(linesSum))}) non corrisponde al nuovo totale ({fmtEur(po.totalAmount)}).
              Aggiorna le posizioni per quadrare l'importo: il flag &laquo;da rivedere&raquo; verrà rimosso automaticamente.
            </p>
          </div>
        </div>
      )}

      {/* Riepilogo testata (solo lettura) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Info icon={Calendar}  label="Data"        value={fmtDate(po.date)} />
          <Info icon={Hash}      label="Numero OdA"  value={po.number} />
          <Info icon={Building2} label="Cliente"     value={po.clientName} />
          <Info icon={Building2} label="Cliente fatturazione" value={po.billingClientName ?? '—'} />
          <Info icon={User}      label="Responsabile">
            <div className="flex flex-col">
              <span>{po.responsibleName}</span>
              <span className="text-xs text-gray-400 flex items-center gap-1"><Mail className="h-3 w-3" />{po.responsibleEmail}</span>
            </div>
          </Info>
          <Info label="Importo totale" value={fmtEur(po.totalAmount)} bold />
          <Info label="N. posizioni"   value={`${po.lines.length}`} />
        </div>
        {po.notes && (
          <div className="pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 flex items-center gap-1 mb-1"><FileText className="h-3 w-3" />Note</div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{po.notes}</p>
          </div>
        )}
        <OrderHeaderEdit
          poId={po.id}
          date={po.date}
          number={po.number}
          totalAmount={po.totalAmount}
          responsibleUserId={po.responsibleUserId}
          notes={po.notes}
          hasPositions={po.lines.length > 0}
          responsibles={responsibles}
          canManage={canManage}
        />
      </div>

      {/* Allegati */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Allegati</h2>
        <OrderAttachmentsManager
          poId={po.id}
          attachments={po.attachments}
          canManage={canManage}
        />
      </div>

      {/* Posizioni */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-gray-800">
          Posizioni
          <span className="ml-2 text-sm font-normal text-gray-400">({po.lines.length})</span>
        </h2>
        <OrderLinesGrid
          purchaseOrderId={po.id}
          totalAmount={po.totalAmount}
          initialLines={po.lines.map((l) => ({
            id:                l.id,
            code:              l.code,
            externalReference: l.externalReference,
            description:       l.description,
            amount:            l.amount,
            engagementId:      l.engagementId,
            statusId:          l.statusId,
          }))}
          engagements={engagements}
          lineStatuses={lineStatuses}
          canManage={canManage}
        />
      </div>
    </div>
  )
}

function Info({ icon: Icon, label, value, children, bold }: {
  icon?: React.ElementType
  label: string
  value?: string
  children?: React.ReactNode
  bold?: boolean
}) {
  return (
    <div>
      <div className="text-xs text-gray-500 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className={bold ? 'text-base font-semibold text-gray-900 mt-0.5' : 'text-sm text-gray-800 mt-0.5'}>
        {children ?? value}
      </div>
    </div>
  )
}
