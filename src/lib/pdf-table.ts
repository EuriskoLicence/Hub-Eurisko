import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib'

export type PdfColumn = {
  header: string
  width:  number
  align?: 'left' | 'right' | 'center'
}

type PdfTableOptions = {
  title:   string
  columns: PdfColumn[]
  rows:    (string | number)[][]
}

// Helper: convert hex color string to rgb() values (0–1)
function hexToRgb(hex: string): ReturnType<typeof rgb> {
  const h = hex.replace('#', '')
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  )
}

/** Genera un Buffer PDF con titolo e tabella. */
export async function generatePdfTable({ title, columns, rows }: PdfTableOptions): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()

  // Embed standard fonts (no external files needed)
  const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // Page geometry (A4 landscape)
  const PAGE_W = PageSizes.A4[1]  // 841.89
  const PAGE_H = PageSizes.A4[0]  // 595.28
  const MARGIN  = 36
  const CONTENT_W = PAGE_W - MARGIN * 2

  // Scale columns to fill content width
  const totalRaw = columns.reduce((s, c) => s + c.width, 0)
  const scale    = CONTENT_W / totalRaw
  const cols     = columns.map((c) => ({ ...c, width: c.width * scale }))

  // Sizes
  const TITLE_SIZE  = 13
  const FONT_SIZE   = 8
  const HEADER_H    = 22
  const ROW_H       = 18
  const PAGE_NUM_H  = 14  // reserve at bottom for page numbers

  // Colors
  const HEADER_BG  = hexToRgb('#374151')
  const HEADER_FG  = rgb(1, 1, 1)
  const ROW_ALT    = hexToRgb('#F9FAFB')
  const BORDER     = hexToRgb('#E5E7EB')
  const TEXT_DARK  = hexToRgb('#111827')
  const TEXT_LIGHT = hexToRgb('#9CA3AF')

  // pdf-lib origin is bottom-left; we track a "cursor Y from top"
  let page = pdfDoc.addPage([PAGE_W, PAGE_H])
  let cursorY = MARGIN  // distance from top

  function pdfY(topY: number): number {
    return PAGE_H - topY
  }

  function addNewPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H])
    cursorY = MARGIN
  }

  // ── Title ──────────────────────────────────────────────────────────────────
  page.drawText(title, {
    x:    MARGIN,
    y:    pdfY(cursorY + TITLE_SIZE),
    font: fontBold,
    size: TITLE_SIZE,
    color: TEXT_DARK,
  })
  cursorY += TITLE_SIZE + 10  // title height + gap

  // ── Draw header row ────────────────────────────────────────────────────────
  function drawHeader() {
    // Background rect
    page.drawRectangle({
      x:      MARGIN,
      y:      pdfY(cursorY + HEADER_H),
      width:  CONTENT_W,
      height: HEADER_H,
      color:  HEADER_BG,
    })

    let cx = MARGIN
    for (const col of cols) {
      const text = col.header
      const textW = fontBold.widthOfTextAtSize(text, FONT_SIZE)
      const cellInnerW = col.width - 8

      let textX = cx + 4
      if (col.align === 'right') {
        textX = cx + col.width - 4 - Math.min(textW, cellInnerW)
      } else if (col.align === 'center') {
        textX = cx + 4 + Math.max(0, (cellInnerW - textW) / 2)
      }

      page.drawText(text.substring(0, estimateMaxChars(fontBold, text, cellInnerW, FONT_SIZE)), {
        x:     textX,
        y:     pdfY(cursorY + (HEADER_H + FONT_SIZE) / 2),
        font:  fontBold,
        size:  FONT_SIZE,
        color: HEADER_FG,
      })
      cx += col.width
    }
    cursorY += HEADER_H
  }

  // ── Truncate text to fit within width ─────────────────────────────────────
  function estimateMaxChars(font: typeof fontBold, text: string, maxWidth: number, size: number): number {
    let lo = 0, hi = text.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (font.widthOfTextAtSize(text.substring(0, mid), size) <= maxWidth) {
        lo = mid
      } else {
        hi = mid - 1
      }
    }
    return lo
  }

  function fitText(font: typeof fontBold, text: string, maxWidth: number, size: number): string {
    const maxChars = estimateMaxChars(font, text, maxWidth, size)
    if (maxChars >= text.length) return text
    // Try to fit with ellipsis
    const ellipsis = '…'
    const ellipsisW = font.widthOfTextAtSize(ellipsis, size)
    const maxWithEllipsis = estimateMaxChars(font, text, maxWidth - ellipsisW, size)
    return text.substring(0, maxWithEllipsis) + ellipsis
  }

  drawHeader()

  // ── Data rows ──────────────────────────────────────────────────────────────
  rows.forEach((row, i) => {
    // Check if new page needed (leave room for page number at bottom)
    if (cursorY + ROW_H > PAGE_H - MARGIN - PAGE_NUM_H) {
      addNewPage()
      drawHeader()
    }

    // Alternating row background
    if (i % 2 === 1) {
      page.drawRectangle({
        x:      MARGIN,
        y:      pdfY(cursorY + ROW_H),
        width:  CONTENT_W,
        height: ROW_H,
        color:  ROW_ALT,
      })
    }

    // Bottom border
    page.drawLine({
      start: { x: MARGIN,            y: pdfY(cursorY + ROW_H) },
      end:   { x: MARGIN + CONTENT_W, y: pdfY(cursorY + ROW_H) },
      thickness: 0.5,
      color: BORDER,
    })

    // Cell text
    let cx = MARGIN
    for (let ci = 0; ci < cols.length; ci++) {
      const col      = cols[ci]
      const rawCell  = row[ci] !== undefined ? String(row[ci]) : ''
      const cellInnerW = col.width - 8
      const cell     = fitText(fontNormal, rawCell, cellInnerW, FONT_SIZE)
      const textW    = fontNormal.widthOfTextAtSize(cell, FONT_SIZE)

      let textX = cx + 4
      if (col.align === 'right') {
        textX = cx + col.width - 4 - textW
      } else if (col.align === 'center') {
        textX = cx + 4 + Math.max(0, (cellInnerW - textW) / 2)
      }

      page.drawText(cell, {
        x:     textX,
        y:     pdfY(cursorY + (ROW_H + FONT_SIZE) / 2),
        font:  fontNormal,
        size:  FONT_SIZE,
        color: TEXT_DARK,
      })
      cx += col.width
    }
    cursorY += ROW_H
  })

  // ── Page numbers ───────────────────────────────────────────────────────────
  const pageCount = pdfDoc.getPageCount()
  for (let i = 0; i < pageCount; i++) {
    const p    = pdfDoc.getPage(i)
    const text = `Pagina ${i + 1} di ${pageCount}`
    const tw   = fontNormal.widthOfTextAtSize(text, 7)
    p.drawText(text, {
      x:     MARGIN + CONTENT_W - tw,
      y:     PAGE_NUM_H - 2,
      font:  fontNormal,
      size:  7,
      color: TEXT_LIGHT,
    })
  }

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
