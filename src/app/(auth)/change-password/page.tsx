'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { KeyRound } from 'lucide-react'
import { forceChangePassword } from './actions'
import { validatePassword, PASSWORD_HINT } from '@/lib/password-rules'

export default function ChangePasswordPage() {
  const router = useRouter()
  const { update } = useSession()
  const [isPending, startTransition] = useTransition()
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const pwdError = validatePassword(newPwd)
    if (pwdError) { setError(pwdError); return }
    if (newPwd !== confirmPwd) { setError('Le password non coincidono.'); return }

    startTransition(async () => {
      const res = await forceChangePassword(newPwd)
      if (!res.ok) { setError(res.error); return }
      setSuccess(true)
      await update({ mustChangePassword: false })
      router.push('/dashboard')
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <KeyRound className="h-6 w-6 text-blue-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Imposta la tua password</h1>
            <p className="mt-2 text-sm text-center text-gray-500">
              Per continuare devi impostare una nuova password personale.
            </p>
          </div>

          {success ? (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 text-center">
              Password aggiornata. Reindirizzamento…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nuova password</label>
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  disabled={isPending}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder={PASSWORD_HINT}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Conferma password</label>
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  disabled={isPending}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="Ripeti la nuova password"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 mt-2"
              >
                {isPending ? 'Salvataggio…' : 'Imposta password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
