/**
 * Canvas-based PDF Generation for ID Cards
 *
 * ── Why canvas instead of jsPDF text? ────────────────────────────────────────
 * jsPDF embeds fonts and computes glyph metrics internally. Those metrics differ
 * from the browser's CSS renderer, so text positions in the PDF never quite match
 * the drag-editor preview — regardless of how many offset constants you tweak.
 *
 * This module instead renders each card to an off-screen <canvas> using the
 * browser's own 2D API (same HO2/HO fonts, same coordinate maths as the CSS
 * preview), converts it to a PNG, and drops that PNG into the PDF.
 * Result: the PDF is literally a screenshot of the preview — a guaranteed match.
 *
 * ── Root cause of the vertical-squash bug (now fixed) ────────────────────────
 * The SVG background measures 226.7717 pt × 311.811 pt at 72 DPI:
 *   width  = 226.7717 × (25.4 / 72) = 79.97 mm ≈ 80 mm
 *   height = 311.811  × (25.4 / 72) = 109.97 mm ≈ 110 mm
 *
 * Previously CARD_W_MM / GRID_CARD_W were set to 85 mm, which caused the canvas
 * to render 850 × 1100 px while the SVG's native ratio is 800 × 1100 px.
 * ctx.drawImage stretched the SVG 6.25 % horizontally → the design appeared
 * squashed vertically.  The fix is simply to use the correct 80 mm width.
 *
 * Canvas text positioning mirror of the CSS preview
 * ─────────────────────────────────────────────────
 * IDCardCard/IDCardEditor position text with:
 *   left: centerXmm_px   top: ymm_px   transform: translate(-50%, -100%)
 * → the element's BOTTOM sits at ymm, centred on centerXmm.
 *
 * We replicate this on the canvas with:
 *   ctx.textAlign    = 'center'
 *   ctx.textBaseline = 'bottom'   // y = bottom of the em box, ≈ element bottom
 *   ctx.fillText(text, mmToPx(centerXmm), mmToPx(ymm))
 *
 * Grid layout (A4 portrait):
 *   Card slot  — 80 mm × 110 mm
 *   Columns    — 2    Rows — 2    Gap — 5 mm    Centred on A4
 *
 * @module utils/generate-pdf
 */

import { jsPDF } from 'jspdf';
import { IDCardData, HackathonInfo } from '@/types';
import { CardOverlays, DEFAULT_OVERLAYS, CARD_W_MM, CARD_H_MM } from '@/components/id-card/IDCardEditor';

// ─── A4 Grid layout constants ─────────────────────────────────────────────────
const A4_W = 210;
const A4_H = 297;

// CARD_W_MM is now 80 (corrected from 85), CARD_H_MM stays 110.
export const GRID_CARD_W    = CARD_W_MM;        // 80 mm — single source of truth
export const GRID_CARD_H    = CARD_H_MM;        // 110 mm
export const GRID_GAP       = 5;
export const GRID_COLS      = 2;
export const GRID_ROWS      = 2;
export const CARDS_PER_PAGE = GRID_COLS * GRID_ROWS;

const BLOCK_W  = GRID_COLS * GRID_CARD_W + (GRID_COLS - 1) * GRID_GAP; // 165 mm
const BLOCK_H  = GRID_ROWS * GRID_CARD_H + (GRID_ROWS - 1) * GRID_GAP; // 225 mm
const MARGIN_X = (A4_W - BLOCK_W) / 2;  // 22.5 mm
const MARGIN_Y = (A4_H - BLOCK_H) / 2;  // 36.0 mm

// ─── Canvas DPI ───────────────────────────────────────────────────────────────
// 10 px / mm → 800 × 1100 px canvas ≈ 254 DPI — crisp at any print size.
const CANVAS_SCALE = 10;

// ─── Unit helpers ─────────────────────────────────────────────────────────────

/** Millimetres → canvas pixels */
function mmToPx(mm: number): number {
  return mm * CANVAS_SCALE;
}

/** Points → canvas pixels  (pt × 25.4/72 = mm, then × CANVAS_SCALE) */
function ptToCanvasPx(pt: number): number {
  return pt * (25.4 / 72) * CANVAS_SCALE;
}

// ─── Font loading ─────────────────────────────────────────────────────────────

async function ensureBrowserFontsLoaded(): Promise<void> {
  if (typeof document === 'undefined') return;

  const STYLE_ID = '__id-card-fonts__';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @font-face {
        font-family: 'HO2';
        src: url('/fonts/HO2.ttf') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
      @font-face {
        font-family: 'HO';
        src: url('/fonts/HO.ttf') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
    `;
    document.head.appendChild(style);
  }

  await document.fonts.ready;
  await Promise.all([
    document.fonts.load("normal 14px 'HO2'").catch(() => {}),
    document.fonts.load("normal 14px 'HO'").catch(() => {}),
  ]);

  console.log('✓ HO2 + HO fonts ready for canvas rendering');
}

// ─── Image helpers ────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img    = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`loadImage failed: ${src.slice(0, 80)}`));
    img.src = src;
  });
}

async function loadSVGBackgroundImage(): Promise<HTMLImageElement> {
  const res = await fetch('/Images/id.svg');
  if (!res.ok) throw new Error(`SVG fetch failed: ${res.statusText}`);
  const blob = new Blob([await res.text()], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    console.log('✓ SVG background loaded');
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ─── Core: render one card to a data URL ─────────────────────────────────────
// Canvas dimensions now match the SVG's native aspect ratio (80 × 110 mm),
// so drawImage no longer stretches the background.

async function renderCardToDataURL(
  data:          IDCardData,
  backgroundImg: HTMLImageElement,
  overlays:      CardOverlays,
): Promise<string> {
  const W = Math.round(CARD_W_MM * CANVAS_SCALE);  // 800 px
  const H = Math.round(CARD_H_MM * CANVAS_SCALE);  // 1100 px

  const canvas  = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── Background SVG ──────────────────────────────────────────────────────────
  // SVG native: 226.7717 pt × 311.811 pt → 79.97 mm × 110 mm
  // Canvas:     800 px × 1100 px → same 80 × 110 mm at 10 px/mm
  // No stretching — 1-to-1 pixel match with the browser preview.
  ctx.drawImage(backgroundImg, 0, 0, W, H);

  // ── Name (HO2) ──────────────────────────────────────────────────────────────
  {
    const fontPx     = ptToCanvasPx(overlays.name.fontSizePt);
    const maxWidthPx = mmToPx(CARD_W_MM * 0.9);

    ctx.save();
    ctx.font         = `normal ${fontPx}px 'HO2', monospace`;
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';

    const nameText = data.name.toUpperCase();
    const cx       = mmToPx(overlays.name.centerXmm);
    const bY       = mmToPx(overlays.name.ymm);

    ctx.fillText(nameText, cx, bY, maxWidthPx);
    ctx.restore();
  }

  // ── Team ID (HO) ─────────────────────────────────────────────────────────────
  if (overlays.teamId.show && data.teamId) {
    const fontPx   = ptToCanvasPx(overlays.teamId.fontSizePt);
    const teamText = `Team id - ${data.teamId}`;

    ctx.save();
    ctx.font         = `normal ${fontPx}px 'HO', monospace`;
    ctx.fillStyle    = 'rgba(220, 220, 220, 0.85)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';

    ctx.fillText(teamText, mmToPx(overlays.teamId.centerXmm), mmToPx(overlays.teamId.ymm));
    ctx.restore();
  }

  // ── QR Code ──────────────────────────────────────────────────────────────────
  try {
    const qrSrc = data.qrCodeDataURL?.trim().replace(/\s+/g, '');
    if (!qrSrc?.startsWith('data:image/')) throw new Error('Invalid QR data URL');

    const qrImg = await loadImage(qrSrc);
    ctx.drawImage(
      qrImg,
      mmToPx(overlays.qr.xmm),
      mmToPx(overlays.qr.ymm),
      mmToPx(overlays.qr.sizemm),
      mmToPx(overlays.qr.sizemm),
    );
  } catch (err) {
    console.error(`QR error for ${data.participantId}:`, err);
    const qx = mmToPx(overlays.qr.xmm);
    const qy = mmToPx(overlays.qr.ymm);
    const qs = mmToPx(overlays.qr.sizemm);
    ctx.strokeStyle = '#b0b0b0';
    ctx.lineWidth   = CANVAS_SCALE * 0.3;
    ctx.strokeRect(qx, qy, qs, qs);
    ctx.fillStyle    = '#aaaaaa';
    ctx.font         = `${CANVAS_SCALE * 4}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('QR ERROR', qx + qs / 2, qy + qs / 2);
  }

  return canvas.toDataURL('image/png');
}

// ─── Hairline cut guides (vector, A4 grid only) ───────────────────────────────
function drawCutGuides(pdf: jsPDF): void {
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.15);
  pdf.setLineDashPattern([1.5, 1.5], 0);

  for (let c = 0; c < GRID_COLS; c++) {
    const xLeft  = MARGIN_X + c * (GRID_CARD_W + GRID_GAP);
    const xRight = xLeft + GRID_CARD_W;
    pdf.line(xLeft,  0, xLeft,  A4_H);
    pdf.line(xRight, 0, xRight, A4_H);
  }

  for (let r = 0; r < GRID_ROWS; r++) {
    const yTop    = MARGIN_Y + r * (GRID_CARD_H + GRID_GAP);
    const yBottom = yTop + GRID_CARD_H;
    pdf.line(0, yTop,    A4_W, yTop);
    pdf.line(0, yBottom, A4_W, yBottom);
  }

  pdf.setLineDashPattern([], 0);
  pdf.setLineWidth(0.1);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a single-card PDF (card-sized page, 80 × 110 mm).
 */
export async function generateVectorPDF(
  data:           IDCardData,
  _hackathonInfo: HackathonInfo,
  fileName  = 'id-card.pdf',
  overlays: CardOverlays = DEFAULT_OVERLAYS,
): Promise<void> {
  await ensureBrowserFontsLoaded();
  const backgroundImg = await loadSVGBackgroundImage();
  const cardDataURL   = await renderCardToDataURL(data, backgroundImg, overlays);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [CARD_W_MM, CARD_H_MM] });
  pdf.addImage(cardDataURL, 'PNG', 0, 0, CARD_W_MM, CARD_H_MM, 'card', 'FAST');
  pdf.save(fileName);
}

/**
 * Generate one PDF per card, bundled into a ZIP file.
 */
export async function generateBulkVectorPDFs(
  cards:         IDCardData[],
  hackathonInfo: HackathonInfo,
  baseFileName = 'id-cards',
  onProgress?:  (current: number, total: number) => void,
  overlays: CardOverlays = DEFAULT_OVERLAYS,
): Promise<void> {
  await ensureBrowserFontsLoaded();
  const backgroundImg = await loadSVGBackgroundImage();

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  for (let i = 0; i < cards.length; i++) {
    try {
      const card        = cards[i];
      const cardDataURL = await renderCardToDataURL(card, backgroundImg, overlays);
      const pdf         = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [CARD_W_MM, CARD_H_MM] });
      pdf.addImage(cardDataURL, 'PNG', 0, 0, CARD_W_MM, CARD_H_MM, `card_${i}`, 'FAST');
      zip.file(
        `${card.name.replace(/\s+/g, '_')}_${card.participantId}.pdf`,
        pdf.output('blob'),
      );
      onProgress?.(i + 1, cards.length);
    } catch (err) {
      console.error(`Card ${i} (${cards[i]?.participantId}) failed:`, err);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url  = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `${baseFileName}_individual.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate a multi-page A4 grid PDF (2 × 2 cards per page, hairline cut guides).
 * Card slots: 80 × 110 mm · Gap: 5 mm · Margins: 22.5 mm (H) / 36 mm (V)
 */
export async function generateGridPDF(
  cards:          IDCardData[],
  _hackathonInfo: HackathonInfo,
  fileName  = 'id-cards-grid.pdf',
  onProgress?:   (current: number, total: number) => void,
  overlays: CardOverlays = DEFAULT_OVERLAYS,
): Promise<void> {
  if (cards.length === 0) return;

  await ensureBrowserFontsLoaded();
  const backgroundImg = await loadSVGBackgroundImage();

  // Render all cards up front so progress feels linear.
  const cardDataURLs: string[] = [];
  for (let i = 0; i < cards.length; i++) {
    cardDataURLs.push(await renderCardToDataURL(cards[i], backgroundImg, overlays));
    onProgress?.(Math.round(((i + 1) / cards.length) * 50), 100);
  }

  const pdf        = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const totalPages = Math.ceil(cards.length / CARDS_PER_PAGE);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) pdf.addPage('a4', 'portrait');
    drawCutGuides(pdf);

    const pageStart = pageIdx * CARDS_PER_PAGE;
    const pageEnd   = Math.min(pageStart + CARDS_PER_PAGE, cards.length);

    for (let i = pageStart; i < pageEnd; i++) {
      const slot = i - pageStart;
      const col  = slot % GRID_COLS;
      const row  = Math.floor(slot / GRID_COLS);
      const x    = MARGIN_X + col * (GRID_CARD_W + GRID_GAP);
      const y    = MARGIN_Y + row * (GRID_CARD_H + GRID_GAP);

      try {
        pdf.addImage(cardDataURLs[i], 'PNG', x, y, GRID_CARD_W, GRID_CARD_H, `card_${i}`, 'FAST');
      } catch (err) {
        console.error(`Grid slot ${i} failed:`, err);
      }

      onProgress?.(50 + Math.round(((i + 1) / cards.length) * 50), 100);
    }
  }

  console.log(
    `✓ Grid PDF: ${cards.length} cards / ${totalPages} A4 page(s) ` +
    `— 2×2 · ${GRID_CARD_W}×${GRID_CARD_H} mm slots · ${GRID_GAP} mm gap · ` +
    `margins ${MARGIN_X}mm (H) / ${MARGIN_Y}mm (V)`,
  );
  pdf.save(fileName);
}