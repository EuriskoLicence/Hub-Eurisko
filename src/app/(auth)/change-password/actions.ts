'use server'

import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { requireAuthenticated } from '@/lib/permissions/auth-helpers'
import { validatePassword } from '@/lib/password-rules'

export async function forceChangePassword(
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireAuthenticated(session)

    const pwdError = validatePassword(newPassword ?? '')
    if (pwdError) return { ok: false, error: pwdError }

    const newHash = await bcrypt.hash(newPassword, 12)
    await db.update(users)
      .set({ passwordHash: newHash, mustChangePassword: false, tempPassword: null })
      .where(eq(users.id, session.user.id))

    return { ok: true }
  } catch {
    return { ok: false, error: 'Errore del server. Riprova.' }
  }
}
