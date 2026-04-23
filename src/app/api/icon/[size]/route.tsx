import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(
  req: NextRequest,
  { params }: { params: { size: string } },
) {
  const size    = params.size === '512' ? 512 : 192
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
  const logoUrl = `${baseUrl}/favicon-64.png`

  return new ImageResponse(
    (
      <div
        style={{
          width:           size,
          height:          size,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          background:      '#ffffff',
          borderRadius:    size * 0.18,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          width={size * 0.72}
          height={size * 0.72}
          alt="Hub Eurisko"
        />
      </div>
    ),
    { width: size, height: size },
  )
}
