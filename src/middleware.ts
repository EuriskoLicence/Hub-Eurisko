import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn   = !!session
  const isLoginPage  = nextUrl.pathname === '/login'
  const isApiAuth    = nextUrl.pathname.startsWith('/api/auth')

  // Le route /api/auth/** sono sempre pubbliche (gestite da NextAuth)
  if (isApiAuth) return NextResponse.next()

  // Utente non autenticato → redirect a /login
  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL('/login', nextUrl.origin)
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Utente già autenticato che visita /login → redirect a /dashboard
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl.origin))
  }

  // Utente autenticato con mustChangePassword → forza cambio password
  const isChangePasswordPage = nextUrl.pathname === '/change-password'
  if (isLoggedIn && !isChangePasswordPage && !isApiAuth && session?.user?.mustChangePassword) {
    return NextResponse.redirect(new URL('/change-password', nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  // Esclude file statici, immagini Next.js, favicon e file nella cartella public
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|png|gif|svg|webp|ico|css|js)).*)'],
}
