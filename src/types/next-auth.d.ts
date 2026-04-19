import type { SectionCode } from '@/lib/permissions/sections'

// Estende i tipi di NextAuth per includere i campi custom
// presenti nel JWT e nella sessione.

declare module 'next-auth' {
  interface User {
    id:                 string
    email:              string
    firstName:          string
    lastName:           string
    roleId:             string
    roleName:           string
    sections:           SectionCode[]
    mustChangePassword: boolean
  }

  interface Session {
    user: {
      id:                 string
      email:              string
      firstName:          string
      lastName:           string
      roleId:             string
      roleName:           string
      sections:           SectionCode[]
      mustChangePassword: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id:                 string
    firstName:          string
    lastName:           string
    roleId:             string
    roleName:           string
    sections:           SectionCode[]
    mustChangePassword: boolean
  }
}
