/**
 * Vector PDF Generation for ID Cards
 *
 * Font assignments:
 *   Name text  → HO2.ttf
 *   Team ID    → HO.ttf
 *
 * Grid layout (A4 portrait):
 *   Card slot  — 85 mm × 110 mm  (8.5 cm × 11 cm)
 *   Columns    — 2
 *   Rows       — 2  (4 cards per page)
 *   Gap        — 5 mm between cards
 *   Margins    — centred on A4
 *
 * KEY FIX: drawCardAt uses UNIFORM scaling (Math.min(sx, sy)) so that the
 * card background and all overlay positions share one scale factor.
 * The scaled card is centred inside its slot, exactly matching the
 * single-card PDF output — no distortion, no drift.
 *
 * @module utils/generate-pdf
 */

import { jsPDF } from 'jspdf';
import { IDCardData, HackathonInfo } from '@/types';
import { CardOverlays, DEFAULT_OVERLAYS, CARD_W_MM, CARD_H_MM } from '@/components/id-card/IDCardEditor';

const CARD_FORMAT: [number, number] = [CARD_W_MM, CARD_H_MM];

// ─── A4 Grid layout constants ─────────────────────────────────────────────────
const A4_W = 210; // mm
const A4_H = 297; // mm

// Card slot size on A4: 8.5 cm × 11 cm
export const GRID_CARD_W = 85;   // mm  (slot width)
export const GRID_CARD_H = 110;  // mm  (slot height)

// Gap between adjacent slots — breathing room for cutting
export const GRID_GAP = 5; // mm

export const GRID_COLS      = 2;
export const GRID_ROWS      = 2;
export const CARDS_PER_PAGE = GRID_COLS * GRID_ROWS; // 4

// Total block dimensions including inner gaps
const BLOCK_W = GRID_COLS * GRID_CARD_W + (GRID_COLS - 1) * GRID_GAP; // 175 mm
const BLOCK_H = GRID_ROWS * GRID_CARD_H + (GRID_ROWS - 1) * GRID_GAP; // 225 mm

// Centre the block on A4
const MARGIN_X = (A4_W - BLOCK_W) / 2; // 17.5 mm
const MARGIN_Y = (A4_H - BLOCK_H) / 2; // 36.0 mm

// ─── SVG render scale ─────────────────────────────────────────────────────────
const HIGH_DPI_SCALE = 7; // 7× = ~1589 px wide — professional print quality

// SVG source dimensions at 96 DPI
const SVG_W_PX = 226.77;
const SVG_H_PX = 283.46;

// ─── Font cache ───────────────────────────────────────────────────────────────

let cachedHO2Base64: string | null = null;
let ho2LoadFailed = false;
let cachedHOBase64: string | null = null;
let hoLoadFailed = false;

async function loadFont(
  path: string,
  cache: { value: string | null },
  failed: { value: boolean },
  label: string,
): Promise<string> {
  if (cache.value) return cache.value;
  if (failed.value) return '';
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const buf   = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary  = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    cache.value = btoa(binary);
    console.log(`✓ Font loaded: ${label}`);
    return cache.value;
  } catch (err) {
    console.warn(`Font not loaded (${label}), falling back to Helvetica:`, err);
    failed.value = true;
    return '';
  }
}

async function loadNameFont(): Promise<string> {
  const cache  = { get value() { return cachedHO2Base64; }, set value(v: string | null) { cachedHO2Base64 = v; } };
  const failed = { get value() { return ho2LoadFailed;   }, set value(v: boolean)       { ho2LoadFailed   = v; } };
  return loadFont('/fonts/HO2.ttf', cache, failed, 'HO2 (name)');
}

async function loadTeamIdFont(): Promise<string> {
  const cache  = { get value() { return cachedHOBase64; }, set value(v: string | null) { cachedHOBase64 = v; } };
  const failed = { get value() { return hoLoadFailed;   }, set value(v: boolean)       { hoLoadFailed   = v; } };
  return loadFont('/fonts/HO.ttf', cache, failed, 'HO (teamId)');
}

function addHO2Font(pdf: jsPDF, base64: string): boolean {
  if (!base64) return false;
  try {
    pdf.addFileToVFS('HO2-Regular.ttf', base64);
    pdf.addFont('HO2-Regular.ttf', 'HO2', 'normal');
    return true;
  } catch { return false; }
}

function addHOFont(pdf: jsPDF, base64: string): boolean {
  if (!base64) return false;
  try {
    pdf.addFileToVFS('HO-Regular.ttf', base64);
    pdf.addFont('HO-Regular.ttf', 'HO', 'normal');
    return true;
  } catch { return false; }
}

function registerFonts(
  pdf: jsPDF,
  nameFontBase64: string,
  teamIdFontBase64: string,
): { hasNameFont: boolean; hasTeamIdFont: boolean } {
  return {
    hasNameFont:   addHO2Font(pdf, nameFontBase64),
    hasTeamIdFont: addHOFont(pdf, teamIdFontBase64),
  };
}

// ─── SVG → High-DPI PNG ───────────────────────────────────────────────────────
async function loadSVGAsHighDPIPNG(): Promise<string> {
  const res = await fetch('/Images/id.svg');
  if (!res.ok) throw new Error(`Failed to load SVG: ${res.statusText}`);
  const svgText = await res.text();
  const blob = new Blob([svgText], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img    = new Image();
    const canvas = document.createElement('canvas');
    canvas.width  = SVG_W_PX * HIGH_DPI_SCALE;
    canvas.height = SVG_H_PX * HIGH_DPI_SCALE;
    const ctx = canvas.getContext('2d')!;

    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      console.log(`✓ SVG → PNG at ${canvas.width}×${canvas.height}px (${HIGH_DPI_SCALE}×)`);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG render failed'));
    };
    img.src = url;
  });
}

// ─── Core renderer ────────────────────────────────────────────────────────────
/**
 * Draws one card into `pdf`, fitting it inside the rectangle
 * (slotX, slotY, slotW, slotH) while preserving the native card aspect ratio.
 *
 * The card is scaled uniformly (Math.min(sx, sy)) and centred inside the slot.
 * Every overlay position uses the same single scale factor, so the grid output
 * is pixel-identical to the individual PDF output — just smaller.
 */
function drawCardAt(
  pdf: jsPDF,
  data: IDCardData,
  backgroundPNG: string,
  hasNameFont: boolean,
  hasTeamIdFont: boolean,
  overlays: CardOverlays,
  slotX: number,
  slotY: number,
  slotW: number,
  slotH: number,
): void {
  // ── Uniform scale: fit card inside slot, preserve aspect ratio ──
  const sx = slotW / CARD_W_MM;
  const sy = slotH / CARD_H_MM;
  const s  = Math.min(sx, sy); // single uniform scale factor

  // Actual rendered card dimensions (may be smaller than slot on one axis)
  const renderedW = CARD_W_MM * s;
  const renderedH = CARD_H_MM * s;

  // Centre the card inside the slot
  const ox = slotX + (slotW - renderedW) / 2; // x origin of rendered card
  const oy = slotY + (slotH - renderedH) / 2; // y origin of rendered card

  // ── Background ──
  try {
    pdf.addImage(
      backgroundPNG, 'PNG',
      ox, oy, renderedW, renderedH,
      `bg_${data.participantId}_${ox.toFixed(1)}_${oy.toFixed(1)}`,
      'FAST',
    );
  } catch {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(ox, oy, renderedW, renderedH, 'F');
  }

  // ── Name  (HO2) ──
  pdf.setTextColor(255, 255, 255);
  pdf.setFont(hasNameFont ? 'HO2' : 'helvetica', hasNameFont ? 'normal' : 'bold');
  pdf.setFontSize(overlays.name.fontSizePt * s);

  const nameParts     = data.name.toUpperCase().split(' ');
  const lineSpacingMM = overlays.name.fontSizePt * s * (25.4 / 72) * 1.4;
  const nameCx        = ox + overlays.name.centerXmm * s;
  const nameY         = oy + overlays.name.ymm       * s;

  if (nameParts.length > 2) {
    const mid   = Math.ceil(nameParts.length / 2);
    const line1 = nameParts.slice(0, mid).join(' ');
    const line2 = nameParts.slice(mid).join(' ');
    pdf.text(line1, nameCx, nameY,                 { align: 'center', maxWidth: renderedW * 0.9 });
    pdf.text(line2, nameCx, nameY + lineSpacingMM, { align: 'center', maxWidth: renderedW * 0.9 });
  } else {
    pdf.text(data.name.toUpperCase(), nameCx, nameY, { align: 'center', maxWidth: renderedW * 0.9 });
  }

  // ── Team ID  (HO) ──
  if (overlays.teamId.show && data.teamId) {
    pdf.setFontSize(overlays.teamId.fontSizePt * s);
    pdf.setTextColor(220, 220, 220);
    pdf.setFont(hasTeamIdFont ? 'HO' : 'helvetica', 'normal');
    pdf.text(
      `Team id - ${data.teamId}`,
      ox + overlays.teamId.centerXmm * s,
      oy + overlays.teamId.ymm       * s,
      { align: 'center' },
    );
  }

  // ── QR Code ──
  const qrX    = ox + overlays.qr.xmm    * s;
  const qrY    = oy + overlays.qr.ymm    * s;
  const qrSize = overlays.qr.sizemm      * s; // uniform scale keeps it square
  try {
    const qr = data.qrCodeDataURL?.trim().replace(/\s+/g, '');
    if (!qr?.startsWith('data:image/')) throw new Error('Invalid QR data URL');
    const fmt = qr.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    pdf.addImage(
      qr, fmt, qrX, qrY, qrSize, qrSize,
      `qr_${data.participantId}_${ox.toFixed(1)}`,
      'FAST',
    );
  } catch (err) {
    console.error(`QR error for ${data.participantId}:`, err);
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.3);
    pdf.rect(qrX, qrY, qrSize, qrSize, 'S');
    pdf.setFontSize(6);
    pdf.setTextColor(160, 160, 160);
    pdf.setFont('helvetica', 'normal');
    pdf.text('QR ERROR', qrX + qrSize / 2, qrY + qrSize / 2, { align: 'center' });
  }
}

// ─── Hairline cut guides ──────────────────────────────────────────────────────
/**
 * Dashed lines along each card edge, running full A4 width/height
 * so they're easy to align with a guillotine cutter.
 */
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
 * Generate a single PDF ID card (native card size) and trigger download.
 */
export async function generateVectorPDF(
  data: IDCardData,
  _hackathonInfo: HackathonInfo,
  fileName = 'id-card.pdf',
  overlays: CardOverlays = DEFAULT_OVERLAYS,
): Promise<void> {
  const [backgroundPNG, nameFontBase64, teamIdFontBase64] = await Promise.all([
    loadSVGAsHighDPIPNG(), loadNameFont(), loadTeamIdFont(),
  ]);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: CARD_FORMAT });
  const { hasNameFont, hasTeamIdFont } = registerFonts(pdf, nameFontBase64, teamIdFontBase64);
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  // Slot == full page → s = 1.0, no centering offset needed
  drawCardAt(pdf, data, backgroundPNG, hasNameFont, hasTeamIdFont, overlays, 0, 0, W, H);
  pdf.save(fileName);
}

/**
 * Generate one PDF per card (native card size), zip them all, and trigger download.
 */
export async function generateBulkVectorPDFs(
  cards: IDCardData[],
  hackathonInfo: HackathonInfo,
  baseFileName = 'id-cards',
  onProgress?: (current: number, total: number) => void,
  overlays: CardOverlays = DEFAULT_OVERLAYS,
): Promise<void> {
  const [backgroundPNG, nameFontBase64, teamIdFontBase64] = await Promise.all([
    loadSVGAsHighDPIPNG(), loadNameFont(), loadTeamIdFont(),
  ]);
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  for (let i = 0; i < cards.length; i++) {
    try {
      const card = cards[i];
      const pdf  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: CARD_FORMAT });
      const { hasNameFont, hasTeamIdFont } = registerFonts(pdf, nameFontBase64, teamIdFontBase64);
      const W = pdf.internal.pageSize.getWidth();
      const H = pdf.internal.pageSize.getHeight();
      drawCardAt(pdf, card, backgroundPNG, hasNameFont, hasTeamIdFont, overlays, 0, 0, W, H);
      zip.file(`${card.name.replace(/\s+/g, '_')}_${card.participantId}.pdf`, pdf.output('blob'));
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
 * Generate a single A4 PDF with all cards in a 2×2 grid.
 *
 * Layout (mm):
 *   Sheet    — A4 portrait  210 × 297
 *   Slot     — 85 × 110  (8.5 cm × 11 cm)
 *   Gap      — 5 mm between slots
 *   Block    — 175 × 225 mm
 *   Margin X — 17.5 mm  |  Margin Y — 36.0 mm
 *
 * Each card is scaled UNIFORMLY to fit its slot (aspect ratio preserved),
 * then centred inside the slot — identical appearance to individual PDFs.
 */
export async function generateGridPDF(
  cards: IDCardData[],
  _hackathonInfo: HackathonInfo,
  fileName = 'id-cards-grid.pdf',
  onProgress?: (current: number, total: number) => void,
  overlays: CardOverlays = DEFAULT_OVERLAYS,
): Promise<void> {
  if (cards.length === 0) return;

  const [backgroundPNG, nameFontBase64, teamIdFontBase64] = await Promise.all([
    loadSVGAsHighDPIPNG(), loadNameFont(), loadTeamIdFont(),
  ]);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { hasNameFont, hasTeamIdFont } = registerFonts(pdf, nameFontBase64, teamIdFontBase64);

  const totalPages = Math.ceil(cards.length / CARDS_PER_PAGE);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) pdf.addPage('a4', 'portrait');

    drawCutGuides(pdf);

    const pageCards = cards.slice(pageIdx * CARDS_PER_PAGE, (pageIdx + 1) * CARDS_PER_PAGE);

    for (let slot = 0; slot < pageCards.length; slot++) {
      const col   = slot % GRID_COLS;
      const row   = Math.floor(slot / GRID_COLS);
      const slotX = MARGIN_X + col * (GRID_CARD_W + GRID_GAP);
      const slotY = MARGIN_Y + row * (GRID_CARD_H + GRID_GAP);

      try {
        drawCardAt(
          pdf, pageCards[slot], backgroundPNG,
          hasNameFont, hasTeamIdFont, overlays,
          slotX, slotY, GRID_CARD_W, GRID_CARD_H,
        );
      } catch (err) {
        console.error(`Grid slot ${pageIdx * CARDS_PER_PAGE + slot} failed:`, err);
      }

      onProgress?.(pageIdx * CARDS_PER_PAGE + slot + 1, cards.length);
    }
  }

  console.log(
    `✓ Grid PDF: ${cards.length} cards / ${totalPages} A4 page(s) ` +
    `— 2×2 · ${GRID_CARD_W}×${GRID_CARD_H} mm slots · ${GRID_GAP} mm gap`,
  );
  pdf.save(fileName);
}