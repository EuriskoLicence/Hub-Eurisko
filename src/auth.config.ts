import type { NextAuthConfig } from 'next-auth'
import type { SectionCode } from '@/lib/permissions/sections'

/**
 * Configurazione Edge-compatibile di NextAuth.
 * NON importa bcryptjs né il database — può girare sul middleware (Edge Runtime).
 * I providers vengono aggiunti in auth.ts (Node.js only).
 */
export const authConfig: NextAuthConfig = {
  providers: [], // aggiunto in auth.ts

  session: {
    strategy: 'jwt',
    maxAge:   8 * 60 * 60, // 8 ore
  },

  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id                 = user.id
        token.firstName          = user.firstName
        token.lastName           = user.lastName
        token.roleId             = user.roleId
        token.roleName           = user.roleName
        token.sections           = user.sections
        token.mustChangePassword = user.mustChangePassword
      }
      if (trigger === 'update' && session?.mustChangePassword === false) {
        token.mustChangePassword = false
      }
      return token
    },

    session({ session, token }) {
      session.user.id                 = token.id as string
      session.user.firstName          = token.firstName as string
      session.user.lastName           = token.lastName as string
      session.user.roleId             = token.roleId as string
      session.user.roleName           = token.roleName as string
      session.user.sections           = token.sections as SectionCode[]
      session.user.mustChangePassword = (token.mustChangePassword as boolean) ?? false
      return session
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },
}
