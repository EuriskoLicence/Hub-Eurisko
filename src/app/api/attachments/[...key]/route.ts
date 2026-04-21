import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getPresignedGetUrl, deleteObject } from '@/lib/r2'
import { hasSection } from '@/lib/permissions/auth-helpers'

export async function GET(
  req:     NextRequest,
  { params }: { params: { key: string[] } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Ricostruisce la chiave R2 dai segmenti del path
  const key = params.key.join('/')

  // Sicurezza: l'utente può accedere solo ai propri file,
  // a meno che non abbia accesso Finance (per visualizzare allegati di altri utenti)
  const isOwner       = key.startsWith(`expenses/${session.user.id}/`)
  const hasFinance    = hasSection(session, 'FINANCE_DASHBOARD') ||
                        hasSection(session, 'FINANCE_AMENDMENT')

  if (!isOwner && !hasFinance) {
    return NextResponse.json({ error: 'Accesso negato.' }, { status: 403 })
  }

  const url = await getPresignedGetUrl(key)
  // Redirect diretto alla presigned URL (il browser la usa per scaricare/visualizzare)
  return NextResponse.redirect(url)
}

export async function DELETE(
  _req:    NextRequest,
  { params }: { params: { key: string[] } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const key = params.key.join('/')

  // Solo il proprietario può cancellare i propri file
  const isOwner = key.startsWith(`expenses/${session.user.id}/`)
  if (!isOwner) {
    return NextResponse.json({ error: 'Accesso negato.' }, { status: 403 })
  }

  await deleteObject(key)
  return NextResponse.json({ ok: true })
}
