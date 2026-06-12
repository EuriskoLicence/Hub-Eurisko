import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { FileText, ChevronLeft, AlertTriangle, Building2, Calendar, Hash, Euro, CheckCircle2 } from 'lucide-react'
import { getInvoiceDetail, getOdaLinesForClient, getReferencedInvoicedOdaLines } from '../actions'
import { getClientList } from '../../actions'
import { InvoiceHeaderEdit }        from '@/components/invoices/InvoiceHeaderEdit'
import { InvoiceAttachmentsManager } from '@/components/invoices/InvoiceAttachmentsManager'
import { InvoiceLinesGrid }         from '@/components/invoices/InvoiceLinesGrid'

type Props = { params: { id: string } }

export const metadata = { title: 'Dettaglio documento' }

export default async function InvoiceDetailPage({ params }: Props) {
  const session = await auth()
  if (!session || !hasSection(session, 'INVOICES_VIEW')) redirect('/dashboard')
  const canManage = hasSection(session, 'INVOICES_MANAGE')

  const inv = await getInvoiceDetail(params.id)
  if (!inv) notFound()

  const [clientsList, openOdaLines, invoicedOdaLines] = await Promise.all([
    canManage ? getClientList(true) : Promise.resolve([]),
    getOdaLinesForClient(inv.clientId),
    getReferencedInvoicedOdaLines(inv.id),
  ])
  // Merge: selezionabili + posizioni storiche in stato INV (visibili ma disabilitate)
  const odaLines = [...openOdaLines, ...invoicedOdaLines]

  function fmtCur(s: string) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: inv!.currency }).format(Number(s))
  }
  function fmtDate(s: string) {
    return new Date(s + 'T00:00:00').toLocaleDateString('it-IT')
  }

  const linesSum   = inv.lines.reduce((s, l) => s + Number(l.amount), 0)
  const expected   = Number(inv.totalAmount) - Number(inv.vatAmount)
  const isBalanced = inv.lines.length > 0 && Math.abs(linesSum - expected) <= 0.01

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 flex items-center gap-1">
        <Link href="/clients/invoices" className="hover:text-gray-600 flex items-center gap-1">
          <ChevronLeft className="h-3 w-3" />
          Fatturazione
        </Link>
        <span>/</span>
        <span className="text-gray-600">N. {inv.documentNumber}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            inv.type === 'credit_note' ? 'bg-violet-100' : 'bg-blue-100'
          }`}>
            <FileText className={`h-5 w-5 ${inv.type === 'credit_note' ? 'text-violet-600' : 'text-blue-600'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">N. {inv.documentNumber}</h1>
              {inv.type === 'credit_note' && (
                <span className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-xs font-medium text-violet-700">
                  Nota credito
                </span>
              )}
              {inv.lines.length > 0 && !isBalanced && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-medium text-red-700">
                  <AlertTriangle className="h-3 w-3" />
                  Da quadrare
                </span>
              )}
              {isBalanced && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs font-medium text-green-700">
                  <CheckCircle2 className="h-3 w-3" />
                  Quadrata
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {inv.type === 'credit_note' ? 'Nota credito' : 'Fattura'} · {inv.clientName}
            </p>
          </div>
        </div>
      </div>

      {/* Riepilogo testata */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Info icon={Building2} label="Cliente"        value={inv.clientName} />
          <Info icon={Calendar}  label="Data documento" value={fmtDate(inv.documentDate)} />
          <Info icon={Hash}      label="Numero"         value={inv.documentNumber} />
          <Info icon={Euro}      label="Divisa"         value={inv.currency} />
          <Info label="Importo Totale" value={fmtCur(inv.totalAmount)} bold />
          <Info label="IVA"            value={fmtCur(inv.vatAmount)} />
        </div>
        {inv.headerText && (
          <div className="pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Testo testata</div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{inv.headerText}</p>
          </div>
        )}
        <InvoiceHeaderEdit
          invoiceId={inv.id}
          clientId={inv.clientId}
          documentDate={inv.documentDate}
          documentNumber={inv.documentNumber}
          type={inv.type}
          currency={inv.currency}
          totalAmount={inv.totalAmount}
          vatAmount={inv.vatAmount}
          headerText={inv.headerText}
          hasLines={inv.lines.length > 0}
          clients={clientsList.map((c) => ({ id: c.id, name: c.name, code: c.code }))}
          canManage={canManage}
        />
      </div>

      {/* Allegati */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Allegati</h2>
        <InvoiceAttachmentsManager
          invoiceId={inv.id}
          attachments={inv.attachments}
          canManage={canManage}
        />
      </div>

      {/* Posizioni */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-gray-800">
          Posizioni
          <span className="ml-2 text-sm font-normal text-gray-400">({inv.lines.length})</span>
        </h2>
        <InvoiceLinesGrid
          invoiceId={inv.id}
          totalAmount={inv.totalAmount}
          vatAmount={inv.vatAmount}
          currency={inv.currency}
          initialLines={inv.lines.map((l) => ({
            id:                    l.id,
            lineNumber:            l.lineNumber,
            isOdaRelated:          l.isOdaRelated,
            isTravelReimbursement: l.isTravelReimbursement,
            description:           l.description,
            amount:                l.amount,
            purchaseOrderLineId:   l.purchaseOrderLineId,
          }))}
          odaLines={odaLines}
          canManage={canManage}
        />
      </div>
    </div>
  )
}

function Info({ icon: Icon, label, value, bold }: {
  icon?: React.ElementType
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div>
      <div className="text-xs text-gray-500 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className={bold ? 'text-base font-semibold text-gray-900 mt-0.5' : 'text-sm text-gray-800 mt-0.5'}>
        {value}
      </div>
    </div>
  )
}
