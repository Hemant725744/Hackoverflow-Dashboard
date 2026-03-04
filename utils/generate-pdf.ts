/**
 * Hybrid-vector PDF Generation for ID Cards
 *
 * ── Why hybrid? ───────────────────────────────────────────────────────────────
 * svg2pdf.js silently drops complex SVG features (embedded raster images,
 * filters, blur, certain gradient types) — which is exactly what id.svg uses.
 * Result: a blank white card with only QR + text visible.
 *
 * The reliable strategy is:
 *
 *   1. SVG background  → rendered to an off-screen <canvas> at 300 DPI, then
 *      embedded as a lossless PNG.  The browser's canvas engine handles every
 *      SVG feature perfectly, so the background is pixel-identical to the
 *      on-screen preview.
 *
 *   2. Name / Team ID  → jsPDF text() with TTF fonts embedded as PDF glyphs.
 *      Infinitely scalable; no pixelation at any zoom level or print size.
 *
 *   3. QR code         → lossless PNG ('NONE' compression). A QR is a pixel
 *      grid by nature — vector adds nothing here.
 *
 * ── Text positioning ──────────────────────────────────────────────────────────
 * IDCardEditor/IDCardCard CSS:
 *   left: centerXmm_px   top: ymm_px   transform: translate(-50%, -100%)
 *   → element BOTTOM sits at ymm, centred on centerXmm.
 *
 * jsPDF text() with { align:'center', baseline:'bottom' } is identical
 * semantics — no fudge offsets needed.
 *
 * ── Grid layout (A4 portrait) ─────────────────────────────────────────────────
 *   Card slot  — 80 mm × 110 mm
 *   Columns 2  Rows 2   Gap 5 mm   Margins 22.5 mm (H) / 36 mm (V)
 *
 * @module utils/generate-pdf
 */

import { jsPDF } from 'jspdf';
import { IDCardData, HackathonInfo } from '@/types';
import { CardOverlays, DEFAULT_OVERLAYS, CARD_W_MM, CARD_H_MM } from '@/components/id-card/IDCardEditor';

// ─── A4 Grid constants ────────────────────────────────────────────────────────
const A4_W = 210;
const A4_H = 297;

export const GRID_CARD_W    = CARD_W_MM;
export const GRID_CARD_H    = CARD_H_MM;
export const GRID_GAP       = 5;
export const GRID_COLS      = 2;
export const GRID_ROWS      = 2;
export const CARDS_PER_PAGE = GRID_COLS * GRID_ROWS;

const BLOCK_W  = GRID_COLS * GRID_CARD_W + (GRID_COLS - 1) * GRID_GAP;  // 165 mm
const BLOCK_H  = GRID_ROWS * GRID_CARD_H + (GRID_ROWS - 1) * GRID_GAP;  // 225 mm
const MARGIN_X = (A4_W - BLOCK_W) / 2;                                    // 22.5 mm
const MARGIN_Y = (A4_H - BLOCK_H) / 2;                                    // 36.0 mm

// ─── Canvas scale ─────────────────────────────────────────────────────────────
// 12 px/mm = 304 DPI — true print quality for the background PNG.
// Text and QR are unaffected (they are vector glyphs / lossless PNG).
const CANVAS_SCALE = 12;

// ─── Module-level resource cache ─────────────────────────────────────────────
let _bgDataURL: string | null = null;          // rendered background PNG
let _fontCache: { ho2: string; ho: string } | null = null;

// ─── Background: SVG → canvas → PNG data URL ─────────────────────────────────
// We load the SVG via a Blob URL (same as before — works cross-origin) and
// draw it onto a canvas at CANVAS_SCALE resolution.  The browser handles every
// SVG feature including filters, embedded images, and complex gradients.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`loadImage failed: ${src.slice(0, 80)}`));
    img.src = src;
  });
}

async function fetchBackgroundDataURL(): Promise<string> {
  if (_bgDataURL) return _bgDataURL;

  const res = await fetch('/Images/id.svg');
  if (!res.ok) throw new Error(`SVG fetch failed: ${res.statusText}`);

  const blob = new Blob([await res.text()], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);

  try {
    const img = await loadImage(url);

    const W = Math.round(CARD_W_MM * CANVAS_SCALE);
    const H = Math.round(CARD_H_MM * CANVAS_SCALE);

    const canvas  = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    canvas.getContext('2d')!.drawImage(img, 0, 0, W, H);

    _bgDataURL = canvas.toDataURL('image/png');
    console.log(`✓ SVG background rasterised at ${W}×${H}px (${CANVAS_SCALE * 25.4 / 25.4 * 25.4 / 25.4 * CANVAS_SCALE}… ≈ ${Math.round(CANVAS_SCALE * 25.4)} DPI)`);
    return _bgDataURL;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ─── Fonts: TTF → base64 ─────────────────────────────────────────────────────

async function toBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed: ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK)
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

async function fetchFonts(): Promise<{ ho2: string; ho: string }> {
  if (_fontCache) return _fontCache;
  const [ho2, ho] = await Promise.all([
    toBase64('/fonts/HO2.ttf'),
    toBase64('/fonts/HO.ttf'),
  ]);
  _fontCache = { ho2, ho };
  console.log('✓ HO2 + HO fonts loaded');
  return _fontCache;
}

function registerFonts(pdf: jsPDF, fonts: { ho2: string; ho: string }): void {
  pdf.addFileToVFS('HO2.ttf', fonts.ho2);
  pdf.addFont('HO2.ttf', 'HO2', 'normal');
  pdf.addFileToVFS('HO.ttf', fonts.ho);
  pdf.addFont('HO.ttf', 'HO', 'normal');
}

// ─── Per-card paint helpers ───────────────────────────────────────────────────

/** Paint the SVG background as a lossless-PNG image into the card slot. */
function paintBackground(
  pdf:      jsPDF,
  bgPNG:    string,
  ox = 0, oy = 0,
  w  = GRID_CARD_W, h = GRID_CARD_H,
): void {
  pdf.addImage(bgPNG, 'PNG', ox, oy, w, h, 'bg', 'NONE');
}

/** Paint name + team ID as embedded-font vector glyphs. */
function paintText(
  pdf:      jsPDF,
  data:     IDCardData,
  overlays: CardOverlays,
  ox = 0, oy = 0,
): void {
  // Name — HO2
  pdf.setFont('HO2', 'normal');
  pdf.setFontSize(overlays.name.fontSizePt);
  pdf.setTextColor(255, 255, 255);
  pdf.text(
    data.name.toUpperCase(),
    ox + overlays.name.centerXmm,
    oy + overlays.name.ymm,
    { align: 'center', baseline: 'bottom' },
  );

  // Team ID — HO
  if (overlays.teamId.show && data.teamId) {
    pdf.setFont('HO', 'normal');
    pdf.setFontSize(overlays.teamId.fontSizePt);
    pdf.setTextColor(187, 187, 187);   // opacity 0.85 of white ≈ rgb(187,187,187)
    pdf.text(
      `Team id - ${data.teamId}`,
      ox + overlays.teamId.centerXmm,
      oy + overlays.teamId.ymm,
      { align: 'center', baseline: 'bottom' },
    );
  }
}

/** Paint QR code as a lossless raster (QR is a pixel grid — vector adds nothing). */
function paintQR(
  pdf:      jsPDF,
  data:     IDCardData,
  overlays: CardOverlays,
  ox = 0, oy = 0,
): void {
  const qrSrc = data.qrCodeDataURL?.trim().replace(/\s+/g, '');
  if (!qrSrc?.startsWith('data:image/')) {
    console.error(`Invalid QR for ${data.participantId}`);
    return;
  }
  pdf.addImage(
    qrSrc, 'PNG',
    ox + overlays.qr.xmm,
    oy + overlays.qr.ymm,
    overlays.qr.sizemm,
    overlays.qr.sizemm,
    `qr_${data.participantId}`,
    'NONE',
  );
}

// ─── Hairline cut guides ──────────────────────────────────────────────────────

function drawCutGuides(pdf: jsPDF): void {
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.15);
  pdf.setLineDashPattern([1.5, 1.5], 0);

  for (let c = 0; c < GRID_COLS; c++) {
    const xL = MARGIN_X + c * (GRID_CARD_W + GRID_GAP);
    pdf.line(xL,            0, xL,            A4_H);
    pdf.line(xL + GRID_CARD_W, 0, xL + GRID_CARD_W, A4_H);
  }
  for (let r = 0; r < GRID_ROWS; r++) {
    const yT = MARGIN_Y + r * (GRID_CARD_H + GRID_GAP);
    pdf.line(0, yT,              A4_W, yT);
    pdf.line(0, yT + GRID_CARD_H, A4_W, yT + GRID_CARD_H);
  }

  pdf.setLineDashPattern([], 0);
  pdf.setLineWidth(0.1);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Single-card PDF (80 × 110 mm page).
 */
export async function generateVectorPDF(
  data:           IDCardData,
  _hackathonInfo: HackathonInfo,
  fileName  = 'id-card.pdf',
  overlays: CardOverlays = DEFAULT_OVERLAYS,
): Promise<void> {
  const [bgPNG, fonts] = await Promise.all([fetchBackgroundDataURL(), fetchFonts()]);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [CARD_W_MM, CARD_H_MM] });
  registerFonts(pdf, fonts);

  paintBackground(pdf, bgPNG, 0, 0, CARD_W_MM, CARD_H_MM);
  paintText(pdf, data, overlays);
  paintQR(pdf, data, overlays);

  pdf.save(fileName);
}

/**
 * One PDF per card → ZIP archive.
 */
export async function generateBulkVectorPDFs(
  cards:         IDCardData[],
  hackathonInfo: HackathonInfo,
  baseFileName = 'id-cards',
  onProgress?:  (current: number, total: number) => void,
  overlays: CardOverlays = DEFAULT_OVERLAYS,
): Promise<void> {
  const [bgPNG, fonts] = await Promise.all([fetchBackgroundDataURL(), fetchFonts()]);
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [CARD_W_MM, CARD_H_MM] });
      registerFonts(pdf, fonts);
      paintBackground(pdf, bgPNG, 0, 0, CARD_W_MM, CARD_H_MM);
      paintText(pdf, card, overlays);
      paintQR(pdf, card, overlays);
      zip.file(
        `${card.name.replace(/\s+/g, '_')}_${card.participantId}.pdf`,
        pdf.output('blob'),
      );
    } catch (err) {
      console.error(`Card ${i} (${card.participantId}) failed:`, err);
    }
    onProgress?.(i + 1, cards.length);
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
 * Multi-page A4 grid PDF — 2 × 2 cards per page with hairline cut guides.
 * Background: 304 DPI PNG. Text: embedded vector font glyphs. QR: lossless PNG.
 */
export async function generateGridPDF(
  cards:          IDCardData[],
  _hackathonInfo: HackathonInfo,
  fileName  = 'id-cards-grid.pdf',
  onProgress?:   (current: number, total: number) => void,
  overlays: CardOverlays = DEFAULT_OVERLAYS,
): Promise<void> {
  if (cards.length === 0) return;

  const [bgPNG, fonts] = await Promise.all([fetchBackgroundDataURL(), fetchFonts()]);

  const pdf        = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  registerFonts(pdf, fonts);

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
      const ox   = MARGIN_X + col * (GRID_CARD_W + GRID_GAP);
      const oy   = MARGIN_Y + row * (GRID_CARD_H + GRID_GAP);

      try {
        paintBackground(pdf, bgPNG, ox, oy, GRID_CARD_W, GRID_CARD_H);
        paintText(pdf, cards[i], overlays, ox, oy);
        paintQR(pdf, cards[i], overlays, ox, oy);
      } catch (err) {
        console.error(`Grid slot ${i} (${cards[i]?.participantId}) failed:`, err);
      }

      onProgress?.(Math.round(((i + 1) / cards.length) * 100), 100);
    }
  }

  console.log(
    `✓ Hybrid PDF: ${cards.length} cards · ${totalPages} A4 page(s) · ` +
    `background @ ${Math.round(CANVAS_SCALE * 25.4)} DPI PNG · text = vector glyphs`,
  );
  pdf.save(fileName);
}