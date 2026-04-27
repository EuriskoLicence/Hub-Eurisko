'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { LogOut, ChevronUp, KeyRound, Smartphone, X, Share, MoreVertical } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// ─── Modale istruzioni installazione ─────────────────────────────────────────

function InstallModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Installa l'app</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 overflow-y-auto max-h-[70vh]">

          {/* iOS */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {/* Apple logo SVG */}
              <svg className="h-5 w-5 text-gray-800 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <h3 className="text-sm font-semibold text-gray-900">iPhone / iPad (Safari)</h3>
            </div>
            <ol className="space-y-2.5 text-sm text-gray-700">
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">1</span>
                <span>Apri <strong>hub.euriskosrl.it</strong> in <strong>Safari</strong> (non Chrome o altri browser)</span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">2</span>
                <span>Tocca il pulsante <strong>Condividi</strong> <Share className="inline h-3.5 w-3.5 align-text-top" /> nella barra in basso</span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">3</span>
                <span>Scorri l'elenco e tocca <strong>«Aggiungi alla schermata Home»</strong></span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">4</span>
                <span>Tocca <strong>«Aggiungi»</strong> in alto a destra per confermare</span>
              </li>
            </ol>
            <p className="text-xs text-gray-400">L'app apparirà nella schermata Home come un'app nativa.</p>
          </div>

          <div className="border-t border-gray-100" />

          {/* Android */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {/* Android logo SVG */}
              <svg className="h-5 w-5 text-green-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 15.341a1 1 0 01-1 1 1 1 0 01-1-1 1 1 0 011-1 1 1 0 011 1m-9.046 0a1 1 0 01-1 1 1 1 0 01-1-1 1 1 0 011-1 1 1 0 011 1m9.908-6.547l1.86-3.224a.387.387 0 00-.141-.529.387.387 0 00-.529.141l-1.885 3.267A11.39 11.39 0 0012 7.748a11.39 11.39 0 00-5.69 1.501L4.425 5.982a.387.387 0 00-.529-.141.387.387 0 00-.141.529l1.86 3.224C3.018 10.808 1.5 13.122 1.5 15.75h21c0-2.628-1.518-4.942-4.115-6.956z"/>
              </svg>
              <h3 className="text-sm font-semibold text-gray-900">Android (Chrome)</h3>
            </div>
            <ol className="space-y-2.5 text-sm text-gray-700">
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-semibold">1</span>
                <span>Apri <strong>hub.euriskosrl.it</strong> in <strong>Chrome</strong></span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-semibold">2</span>
                <span>Tocca il menu <MoreVertical className="inline h-3.5 w-3.5 align-text-top" /> in alto a destra</span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-semibold">3</span>
                <span>Seleziona <strong>«Aggiungi alla schermata Home»</strong> oppure <strong>«Installa app»</strong></span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-semibold">4</span>
                <span>Tocca <strong>«Aggiungi»</strong> o <strong>«Installa»</strong> per confermare</span>
              </li>
            </ol>
            <p className="text-xs text-gray-400">Se Chrome mostra automaticamente il banner «Installa app» in fondo alla pagina, puoi usare quello direttamente.</p>
          </div>

        </div>

        <div className="px-5 py-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── UserMenu ─────────────────────────────────────────────────────────────────

export function UserMenu({ name, email }: { name: string; email: string }) {
  const [open,        setOpen]        = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Chiude il menu cliccando fuori
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <>
      <div className="relative" ref={menuRef}>
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm
                     hover:bg-gray-100 transition-colors"
        >
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
            {initials}
          </div>
          {/* Nome + email */}
          <div className="flex-1 text-left min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{name}</p>
            <p className="truncate text-xs text-gray-500">{email}</p>
          </div>
          <ChevronUp
            className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')}
          />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-900 truncate">{name}</p>
              <p className="text-xs text-gray-500 truncate">{email}</p>
            </div>

            <button
              type="button"
              onClick={() => { setOpen(false); setShowInstall(true) }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-gray-700
                         hover:bg-gray-50 transition-colors"
            >
              <Smartphone className="h-4 w-4 text-gray-400" />
              Installa l'app
            </button>

            <Link
              href="/account/password"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-gray-700
                         hover:bg-gray-50 transition-colors"
            >
              <KeyRound className="h-4 w-4 text-gray-400" />
              Cambia password
            </Link>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-600
                         hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Esci
            </button>
          </div>
        )}
      </div>

      {/* Modale installazione */}
      {showInstall && <InstallModal onClose={() => setShowInstall(false)} />}
    </>
  )
}
