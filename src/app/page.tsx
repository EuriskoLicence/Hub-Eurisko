import { redirect } from 'next/navigation'

// La root "/" reindirizza sempre al dashboard.
// Il middleware gestisce l'autenticazione: se non loggato → /login.
export default function RootPage() {
  redirect('/dashboard')
}
