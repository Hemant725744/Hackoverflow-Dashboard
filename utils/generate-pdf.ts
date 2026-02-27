/**
 * Vector PDF Generation for ID Cards with SVG Background
 *
 * Generates crisp, high-resolution PDF ID cards using jsPDF.
 * SVG is rendered as high-DPI PNG (5x resolution) for professional quality.
 * Only overlays name and QR code on the pre-designed SVG template.
 *
 * @module utils/generate-pdf
 */

import { jsPDF } from 'jspdf';
import { IDCardData, HackathonInfo } from '@/types';

/** 
 * Card dimensions matching id.svg viewBox (226.77 x 283.46)
 * Converting to mm at 96 DPI: (pixels / 96) * 25.4
 */
const SVG_WIDTH_PX = 226.77;
const SVG_HEIGHT_PX = 283.46;
const DPI = 96;
const MM_PER_INCH = 25.4;

// Convert SVG dimensions to mm
const CARD_WIDTH_MM = (SVG_WIDTH_PX / DPI) * MM_PER_INCH;
const CARD_HEIGHT_MM = (SVG_HEIGHT_PX / DPI) * MM_PER_INCH;
const CARD_FORMAT: [number, number] = [CARD_WIDTH_MM, CARD_HEIGHT_MM];

// ==============================================================================
// 🎯 POSITIONING CONTROLS - ADJUST THESE TO MOVE NAME & QR CODE
// ==============================================================================
// All values are in millimeters from the top-left corner of the card
// 
// CARD DIMENSIONS: ~60mm (width) x ~75mm (height)
// 
// ⚠️ IMPORTANT: If name is not visible, try these suggested values:
//    NAME_Y_POSITION = 40 (middle of card)
//    NAME_FONT_SIZE = 14 (bigger text)
//    Then adjust up/down from there

const NAME_X_OFFSET = 0;             // Horizontal offset for name (negative = LEFT, positive = RIGHT)
const NAME_Y_POSITION = 68.5;        // Distance from top for name (increase to move DOWN)
const NAME_FONT_SIZE = 10;           // Font size for participant name
const NAME_LINE_SPACING = 5;         // Space between lines for long names

const QR_SIZE = 15;                  // QR code size in mm (increase for bigger QR)
const QR_X_OFFSET = 0;              // Horizontal offset for QR (negative = LEFT, positive = RIGHT)
const QR_Y_POSITION = 48;           // Distance from top for QR code (increase to move DOWN)

// High-DPI rendering: 5x = professional print quality (1134px width)
// Increase to 6x or 7x for even sharper output if needed
const HIGH_DPI_SCALE = 7;

// Custom font cache
let customFontBase64: string | null = null;
let fontLoadError: boolean = false;

/**
 * Load custom HO font and convert to base64
 */
async function loadCustomFont(): Promise<string> {
  if (customFontBase64) {
    return customFontBase64;
  }
  
  if (fontLoadError) {
    return ''; // Already failed, don't retry
  }

  try {
    console.log('🔤 Loading custom font from /fonts/HO.ttf...');
    const response = await fetch('/fonts/HO.ttf');
    
    if (!response.ok) {
      throw new Error(`Failed to load font: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Convert to base64
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    customFontBase64 = btoa(binary);
    
    console.log(`✓ Custom font loaded (${customFontBase64.length} chars base64)`);
    return customFontBase64;
  } catch (error) {
    console.error('❌ Error loading custom font:', error);
    fontLoadError = true;
    return '';
  }
}

/**
 * Add custom font to PDF instance
 */
function addCustomFontToPDF(pdf: jsPDF, fontBase64: string): boolean {
  if (!fontBase64) {
    console.log('⚠️ No custom font loaded, using Helvetica Bold');
    return false;
  }

  try {
    console.log('📝 Adding HO font to PDF...');
    
    // Add font file to virtual file system
    pdf.addFileToVFS('HO-Regular.ttf', fontBase64);
    
    // Register the font
    pdf.addFont('HO-Regular.ttf', 'HO', 'normal');
    
    console.log('✓ Custom font (HO) successfully added to PDF');
    return true;
  } catch (error) {
    console.error('❌ Error adding font to PDF:', error);
    console.log('   Using Helvetica Bold as fallback');
    return false;
  }
}

/**
 * Converts SVG to high-resolution PNG data URL for crisp PDF embedding
 */
async function svgToHighDPIPNG(svgPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    
    // Render at HIGH resolution for professional quality
    const renderWidth = SVG_WIDTH_PX * HIGH_DPI_SCALE;
    const renderHeight = SVG_HEIGHT_PX * HIGH_DPI_SCALE;
    
    canvas.width = renderWidth;
    canvas.height = renderHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      // Draw SVG at high resolution
      ctx.drawImage(img, 0, 0, renderWidth, renderHeight);
      const dataURL = canvas.toDataURL('image/png');
      console.log(`✓ SVG rendered at ${renderWidth}×${renderHeight}px (${HIGH_DPI_SCALE}x scale)`);
      resolve(dataURL);
    };

    img.onerror = () => {
      reject(new Error(`Failed to load SVG from ${svgPath}`));
    };

    // Load SVG
    img.src = svgPath;
  });
}

/**
 * Loads SVG and converts to high-DPI PNG
 */
async function loadSVGAsHighDPIPNG(): Promise<string> {
  try {
    const response = await fetch('/Images/id.svg');
    if (!response.ok) {
      throw new Error(`Failed to load SVG: ${response.statusText}`);
    }
    
    const svgText = await response.text();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const pngDataURL = await svgToHighDPIPNG(url);
    URL.revokeObjectURL(url);
    
    return pngDataURL;
  } catch (error) {
    console.error('Error loading SVG:', error);
    throw error;
  }
}

/**
 * Draws a complete ID card onto the given jsPDF instance.
 * Uses high-DPI PNG background and overlays name + QR code.
 */
async function drawCardOnPDF(
  pdf: jsPDF,
  data: IDCardData,
  backgroundPNG: string,
  customFont: string
): Promise<void> {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Add high-DPI PNG background
  try {
    pdf.addImage(
      backgroundPNG,
      'PNG',
      0,
      0,
      pageWidth,
      pageHeight,
      `bg_${data.participantId}`,
      'FAST'
    );
    console.log(`✓ High-DPI background added for ${data.participantId}`);
  } catch (error) {
    console.error(`Error adding background for ${data.participantId}:`, error);
    // Draw white background as fallback
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  }

  // Try to add custom font
  const hasCustomFont = addCustomFontToPDF(pdf, customFont);

  // ===== OVERLAY: PARTICIPANT NAME =====
  const nameAreaWidth = pageWidth * 0.85;
  const nameCenterX = (pageWidth / 2) + NAME_X_OFFSET;

  // Use WHITE text (visible on dark backgrounds)
  pdf.setTextColor(255, 255, 255);
  
  // Try custom font, fall back to Helvetica Bold
  if (hasCustomFont) {
    try {
      pdf.setFont('HO', 'normal');
      console.log(`✓ Using custom HO font for ${data.participantId}`);
    } catch (e) {
      console.log(`⚠️ Font setting failed, using Helvetica Bold`);
      pdf.setFont('helvetica', 'bold');
    }
  } else {
    pdf.setFont('helvetica', 'bold');
  }
  
  pdf.setFontSize(NAME_FONT_SIZE);
  
  // Split long names into multiple lines
  const nameParts = data.name.toUpperCase().split(' ');
  
  if (nameParts.length > 2) {
    // Split into two lines for long names
    const line1 = nameParts.slice(0, Math.ceil(nameParts.length / 2)).join(' ');
    const line2 = nameParts.slice(Math.ceil(nameParts.length / 2)).join(' ');
    
    pdf.text(line1, nameCenterX, NAME_Y_POSITION, {
      align: 'center',
      maxWidth: nameAreaWidth,
    });
    pdf.text(line2, nameCenterX, NAME_Y_POSITION + NAME_LINE_SPACING, {
      align: 'center',
      maxWidth: nameAreaWidth,
    });
  } else {
    pdf.text(data.name.toUpperCase(), nameCenterX, NAME_Y_POSITION, {
      align: 'center',
      maxWidth: nameAreaWidth,
    });
  }

  console.log(`✓ Name added for ${data.participantId}: ${data.name}`);

  // ===== OVERLAY: QR CODE =====
  const qrX = ((pageWidth - QR_SIZE) / 2) + QR_X_OFFSET;

  try {
    if (!data.qrCodeDataURL) {
      throw new Error('QR code data URL is missing');
    }

    // Clean the data URL
    let qrDataURL = data.qrCodeDataURL.trim().replace(/\s+/g, '');
    
    // Validate data URL format
    if (!qrDataURL.startsWith('data:image/')) {
      throw new Error('Invalid data URL format');
    }

    const matches = qrDataURL.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches || !matches[2] || matches[2].length < 50) {
      throw new Error('Invalid or empty base64 data');
    }

    console.log(`✓ Adding QR code for ${data.participantId} (${matches[1]} format)`);

    // Add QR code image
    pdf.addImage(
      qrDataURL,
      matches[1].toUpperCase() === 'PNG' ? 'PNG' : 'JPEG',
      qrX,
      QR_Y_POSITION,
      QR_SIZE,
      QR_SIZE,
      `qr_${data.participantId}`,
      'FAST'
    );
    
    console.log(`✓ QR code successfully added for ${data.participantId}`);
  } catch (error) {
    console.error(`Error adding QR code for ${data.participantId}:`, error);
    
    // Draw placeholder on error
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.rect(qrX, QR_Y_POSITION, QR_SIZE, QR_SIZE, 'S');
    
    pdf.setFontSize(8);
    pdf.setTextColor(180, 180, 180);
    pdf.setFont('helvetica', 'normal');
    pdf.text('QR CODE', (pageWidth / 2) + QR_X_OFFSET, QR_Y_POSITION + QR_SIZE / 2 - 1, { align: 'center' });
    pdf.setFontSize(5);
    pdf.text('ERROR', (pageWidth / 2) + QR_X_OFFSET, QR_Y_POSITION + QR_SIZE / 2 + 2, { align: 'center' });
  }
}

/**
 * Generate a single high-quality PDF ID card and trigger download.
 */
export async function generateVectorPDF(
  data: IDCardData,
  _hackathonInfo: HackathonInfo,
  fileName: string = 'id-card.pdf'
): Promise<void> {
  try {
    // Load resources in parallel
    const [backgroundPNG, customFont] = await Promise.all([
      loadSVGAsHighDPIPNG(),
      loadCustomFont()
    ]);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: CARD_FORMAT,
    });

    await drawCardOnPDF(pdf, data, backgroundPNG, customFont);
    pdf.save(fileName);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

/**
 * Generate multiple high-quality PDFs, zip them, and trigger download.
 */
export async function generateBulkVectorPDFs(
  cards: IDCardData[],
  hackathonInfo: HackathonInfo,
  baseFileName: string = 'id-cards',
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  try {
    // Load resources once for all cards (in parallel)
    const [backgroundPNG, customFont] = await Promise.all([
      loadSVGAsHighDPIPNG(),
      loadCustomFont()
    ]);
    
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (let i = 0; i < cards.length; i++) {
      try {
        const card = cards[i];
        const fileName = `${card.name.replace(/\s+/g, '_')}_${card.participantId}.pdf`;

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: CARD_FORMAT,
        });

        await drawCardOnPDF(pdf, card, backgroundPNG, customFont);

        const pdfBlob = pdf.output('blob');
        zip.file(fileName, pdfBlob);

        onProgress?.(i + 1, cards.length);
      } catch (error) {
        console.error(`Error generating PDF for card ${i} (${cards[i]?.participantId}):`, error);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseFileName}_all.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating bulk PDFs:', error);
    throw error;
  }
}