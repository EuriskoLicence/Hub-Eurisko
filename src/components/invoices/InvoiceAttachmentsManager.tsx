'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { OrderAttachmentsList, type AttachmentItem } from '@/components/orders/OrderAttachmentsList'
import { addInvoiceAttachment, removeInvoiceAttachment } from '@/app/(dashboard)/clients/invoices/actions'

type Props = {
  invoiceId:   string
  attachments: { id: string; key: string; filename: string }[]
  canManage:   boolean
}

export function InvoiceAttachmentsManager({ invoiceId, attachments: initial, canManage }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [list, setList] = useState<AttachmentItem[]>(initial)

  function handleUploaded(att: AttachmentItem) {
    setError('')
    startTransition(async () => {
      const res = await addInvoiceAttachment(invoiceId, { key: att.key, filename: att.filename })
      if (res.ok) {
        setList((prev) => [...prev, { id: res.id, key: att.key, filename: att.filename }])
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  function handleRemoved(att: AttachmentItem) {
    if (!att.id) return
    setError('')
    startTransition(async () => {
      const res = await removeInvoiceAttachment(att.id!)
      if (res.ok) {
        setList((prev) => prev.filter((a) => a.id !== att.id))
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div className="space-y-2">
      <OrderAttachmentsList
        purchaseOrderId={invoiceId}
        kind="invoice"
        attachments={list}
        disabled={!canManage}
        onUploaded={handleUploaded}
        onRemoved={handleRemoved}
        enforceMinOne={false}
      />
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
    </div>
  )
}
