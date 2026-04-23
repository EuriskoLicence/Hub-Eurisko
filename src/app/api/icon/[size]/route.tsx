import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(
  _req: NextRequest,
  { params }: { params: { size: string } },
) {
  const size = params.size === '512' ? 512 : 192

  return new ImageResponse(
    (
      <div
        style={{
          width:           size,
          height:          size,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          background:      '#1e3a5f',
          borderRadius:    size * 0.18,
        }}
      >
        <span
          style={{
            color:      'white',
            fontSize:   size * 0.62,
            fontWeight: 'bold',
            fontFamily: 'Arial, Helvetica, sans-serif',
            lineHeight: 1,
            marginTop:  size * 0.04,
          }}
        >
          E
        </span>
      </div>
    ),
    { width: size, height: size },
  )
}
