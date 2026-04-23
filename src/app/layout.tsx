import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/Providers'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  themeColor:       '#1e3a5f',
  width:            'device-width',
  initialScale:     1,
  maximumScale:     1,
}

export const metadata: Metadata = {
  title:       process.env.NEXT_PUBLIC_APP_NAME ?? 'Hub Eurisko',
  description: 'Portale interno per la gestione delle risorse umane',
  manifest:    '/manifest.webmanifest',
  appleWebApp: {
    capable:           true,
    statusBarStyle:    'default',
    title:             'Hub Eurisko',
  },
  icons: {
    icon:  [
      { url: '/favicon-64.png', sizes: '64x64',   type: 'image/png' },
      { url: '/api/icon/192',   sizes: '192x192',  type: 'image/png' },
      { url: '/api/icon/512',   sizes: '512x512',  type: 'image/png' },
    ],
    apple: [
      { url: '/api/icon/192', sizes: '192x192', type: 'image/png' },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className={inter.className}>
        <ServiceWorkerRegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
