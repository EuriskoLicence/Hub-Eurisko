'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { LogOut, ChevronUp, KeyRound } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function UserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen]   = useState(false)
  const menuRef           = useRef<HTMLDivElement>(null)

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
  )
}
