'use server'

import { signIn } from '@/auth'
import { AuthError } from 'next-auth'
import { z } from 'zod'

const loginSchema = z.object({
  email:    z.string().email('Email non valida'),
  password: z.string().min(1, 'Password obbligatoria'),
})

export type LoginState = {
  error?: string
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email:    formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  try {
    await signIn('credentials', {
      email:       parsed.data.email,
      password:    parsed.data.password,
      redirectTo:  '/dashboard',
    })
    // signIn con redirectTo non ritorna mai — il redirect avviene internamente
    return {}
  } catch (error) {
    // NEXT_REDIRECT non è un errore reale: lo rilanciamo perché Next.js lo gestisca
    if ((error as Error).message === 'NEXT_REDIRECT') throw error

    if (error instanceof AuthError) {
      return { error: 'Email o password non corretti' }
    }

    console.error('Errore login inatteso:', error)
    return { error: 'Errore del server. Riprova.' }
  }
}
