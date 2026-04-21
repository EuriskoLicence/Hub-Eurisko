'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { loginAction, type LoginState } from './actions'
import { Eye, EyeOff } from 'lucide-react'

const initialState: LoginState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white
                 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      style={{ backgroundColor: '#1a2e4a' }}
    >
      {pending ? 'Accesso in corso…' : 'Accedi'}
    </button>
  )
}

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, initialState)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">

      {/* Sfondo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/image.jpg"
        alt=""
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm">

        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/eurisko.jpg"
          alt="Eurisko"
          className="mx-auto mb-6 h-16 w-auto drop-shadow-md"
        />

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <h2 className="text-xl font-bold mb-1" style={{ color: '#1a2e4a' }}>Accedi</h2>
          <p className="text-sm text-gray-400 mb-6">Inserisci le tue credenziali per accedere</p>

          <form action={formAction} className="space-y-4">

            {state.error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {state.error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="mario.rossi@euriskosrl.it"
                className="w-full rounded-xl border border-gray-200 bg-blue-50 px-4 py-3 text-sm text-gray-900
                           placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400
                           focus:border-transparent transition-colors"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••"
                  className="w-full rounded-xl border border-gray-200 bg-blue-50 px-4 py-3 pr-11 text-sm text-gray-900
                             placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400
                             focus:border-transparent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="pt-1">
              <SubmitButton />
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
