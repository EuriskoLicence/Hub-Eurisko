'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { OrderAttachmentsList, type AttachmentItem } from './OrderAttachmentsList'
import { addPurchaseOrderAttachment, removePurchaseOrderAttachment } from '@/app/(dashboard)/clients/orders/actions'

type Props = {
  poId:        string
  attachments: { id: string; key: string; filename: string }[]
  canManage:   boolean
}

export function OrderAttachmentsManager({ poId, attachments: initial, canManage }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [list, setList] = useState<AttachmentItem[]>(initial)

  function handleUploaded(att: AttachmentItem) {
    setError('')
    startTransition(async () => {
      const res = await addPurchaseOrderAttachment(poId, { key: att.key, filename: att.filename })
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
      const res = await removePurchaseOrderAttachment(att.id!)
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
        purchaseOrderId={poId}
        attachments={list}
        disabled={!canManage}
        onUploaded={handleUploaded}
        onRemoved={handleRemoved}
        enforceMinOne
      />
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
    </div>
  )
}
