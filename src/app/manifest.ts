import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'Hub Eurisko',
    short_name:       'Hub Eurisko',
    description:      'Portale interno per la gestione delle risorse umane',
    start_url:        '/',
    display:          'standalone',
    background_color: '#ffffff',
    theme_color:      '#1e3a5f',
    orientation:      'portrait',
    icons: [
      { src: '/api/icon/192', sizes: '192x192', type: 'image/png' },
      { src: '/api/icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
