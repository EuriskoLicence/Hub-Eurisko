'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { changePassword } from './actions'

function PasswordInput({
  id, label, value, onChange, placeholder,
}: {
  id: string; label: string; value: string
  onChange: (v: string) => void; placeholder: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 pr-10 text-sm
                     text-gray-900 placeholder:text-gray-400 focus:outline-none
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export default function ChangePasswordPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [current, setCurrent]   = useState('')
  const [next,    setNext]      = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error,   setError]     = useState<string | null>(null)
  const [success, setSuccess]   = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (next !== confirm) {
      setError('La nuova password e la conferma non coincidono.')
      return
    }

    startTransition(async () => {
      const res = await changePassword(current, next)
      if (!res.ok) {
        setError(res.error)
      } else {
        setSuccess(true)
        setTimeout(() => router.push('/dashboard'), 2000)
      }
    })
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
          <KeyRound className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cambia password</h1>
          <p className="text-sm text-gray-500">Aggiorna la tua password di accesso</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {success ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-semibold text-gray-900">Password aggiornata!</p>
            <p className="text-sm text-gray-500">Verrai reindirizzato alla dashboard…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <PasswordInput
              id="current"
              label="Password attuale"
              value={current}
              onChange={setCurrent}
              placeholder="••••••••"
            />
            <PasswordInput
              id="new"
              label="Nuova password"
              value={next}
              onChange={setNext}
              placeholder="Almeno 8 caratteri"
            />
            <PasswordInput
              id="confirm"
              label="Conferma nuova password"
              value={confirm}
              onChange={setConfirm}
              placeholder="Ripeti la nuova password"
            />

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm
                           font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold
                           text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {isPending ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
