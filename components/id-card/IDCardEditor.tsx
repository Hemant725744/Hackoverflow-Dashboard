'use client';

import React, { useRef, useCallback, forwardRef } from 'react';
import { IDCardData } from '@/types';

// ─── Card Physical Dimensions (mm) ──────────────────────────────────────────
// SVG viewBox: 226.7717 pt × 311.811 pt
//   → 226.7717 × (25.4 / 72) = 79.97 mm  ≈ 80 mm  (width)
//   → 311.811  × (25.4 / 72) = 109.97 mm ≈ 110 mm (height)
export const CARD_W_MM = 80;    // 8.0 cm  ← was wrongly 85, caused vertical squash
export const CARD_H_MM = 110;   // 11.0 cm ← correct

// ─── Types ───────────────────────────────────────────────────────────────────
export interface CardOverlays {
  /** Name text: centerX + baseline-Y in mm */
  name:   { centerXmm: number; ymm: number; fontSizePt: number };
  /** Team ID text: centerX + baseline-Y in mm */
  teamId: { centerXmm: number; ymm: number; fontSizePt: number; show: boolean };
  /** QR code: top-left corner + size in mm */
  qr:     { xmm: number; ymm: number; sizemm: number };
}

// X positions scaled from old 85 mm width → new correct 80 mm:
//   old_xmm × (80 / 85) ≈ old_xmm × 0.9412
export const DEFAULT_OVERLAYS: CardOverlays = {
  name: {
    centerXmm:  52.2,
    ymm:        85.5,
    fontSizePt: 11.5,
  },
  teamId: {
    centerXmm:  52.2,
    ymm:        91.8,
    fontSizePt: 9.5,
    show:       true,
  },
  qr: {
    xmm:    8.9,
    ymm:    77.0,
    sizemm: 19.5,
  },
};

// ─── Font-face injection (preview only) ──────────────────────────────────────
if (typeof document !== 'undefined') {
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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ptToPx(pt: number, previewWidth: number) {
  return pt * (25.4 / 72) * (previewWidth / CARD_W_MM);
}

// ─── IDCardCard ───────────────────────────────────────────────────────────────
interface IDCardCardProps {
  data: IDCardData;
  overlays: CardOverlays;
  /** Display width in px; height is auto from aspect ratio */
  width?: number;
  dimmed?: boolean;
}

export const IDCardCard = forwardRef<HTMLDivElement, IDCardCardProps>(
  ({ data, overlays, width = 400, dimmed = false }, ref) => {
    const height       = width * (CARD_H_MM / CARD_W_MM);
    const xPx          = (mm: number) => (mm / CARD_W_MM) * width;
    const yPx          = (mm: number) => (mm / CARD_H_MM) * height;
    const nameFontPx   = ptToPx(overlays.name.fontSizePt,   width);
    const teamIdFontPx = ptToPx(overlays.teamId.fontSizePt, width);

    return (
      <div
        ref={ref}
        style={{ position: 'relative', width, height, userSelect: 'none', flexShrink: 0 }}
      >
        {/* SVG Background */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Images/id.svg"
            alt=""
            crossOrigin="anonymous"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          />
        </div>

        {/* Name overlay — HO2 font */}
        <div style={{
          position: 'absolute',
          left: xPx(overlays.name.centerXmm),
          top:  yPx(overlays.name.ymm),
          transform: 'translate(-50%, -100%)',
          color: '#fff',
          fontFamily: "'HO2', monospace",
          fontWeight: 'normal',
          fontSize: nameFontPx,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          {data.name.toUpperCase()}
        </div>

        {/* Team ID overlay — HO font */}
        {overlays.teamId.show && data.teamId && (
          <div style={{
            position: 'absolute',
            left: xPx(overlays.teamId.centerXmm),
            top:  yPx(overlays.teamId.ymm),
            transform: 'translate(-50%, -100%)',
            color: '#fff',
            fontFamily: "'HO', monospace",
            fontWeight: 'normal',
            fontSize: teamIdFontPx,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            opacity: 0.85,
          }}>
            {`Team id - ${data.teamId}`}
          </div>
        )}

        {/* QR overlay */}
        <div style={{
          position: 'absolute',
          left:   xPx(overlays.qr.xmm),
          top:    yPx(overlays.qr.ymm),
          width:  xPx(overlays.qr.sizemm),
          height: xPx(overlays.qr.sizemm),
          pointerEvents: 'none',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.qrCodeDataURL} alt="QR" style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>

        {/* Dimmed overlay for deselected cards */}
        {dimmed && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em' }}>
              NOT SELECTED
            </span>
          </div>
        )}
      </div>
    );
  }
);
IDCardCard.displayName = 'IDCardCard';

// ─── IDCardEditor ─────────────────────────────────────────────────────────────
type DragType = 'name' | 'teamId' | 'qr';

interface IDCardEditorProps {
  data: IDCardData;
  overlays: CardOverlays;
  onOverlaysChange: (o: CardOverlays) => void;
  previewWidth?: number;
}

export default function IDCardEditor({
  data,
  overlays,
  onOverlaysChange,
  previewWidth = 320,
}: IDCardEditorProps) {
  const previewH = previewWidth * (CARD_H_MM / CARD_W_MM);

  const xMmToPx = useCallback((mm: number) => (mm / CARD_W_MM) * previewWidth, [previewWidth]);
  const yMmToPx = useCallback((mm: number) => (mm / CARD_H_MM) * previewH,     [previewH]);
  const xPxToMm = useCallback((px: number) => (px / previewWidth) * CARD_W_MM, [previewWidth]);
  const yPxToMm = useCallback((px: number) => (px / previewH)     * CARD_H_MM, [previewH]);

  const nameFontPx   = ptToPx(overlays.name.fontSizePt,   previewWidth);
  const teamIdFontPx = ptToPx(overlays.teamId.fontSizePt, previewWidth);

  const drag = useRef<{
    type: DragType;
    startClientX: number;
    startClientY: number;
    startXmm: number;
    startYmm: number;
  } | null>(null);

  const getStartPos = (type: DragType) => {
    if (type === 'name')   return { x: overlays.name.centerXmm,   y: overlays.name.ymm   };
    if (type === 'teamId') return { x: overlays.teamId.centerXmm, y: overlays.teamId.ymm };
    return                        { x: overlays.qr.xmm,           y: overlays.qr.ymm     };
  };

  const handlePointerDown = (e: React.PointerEvent, type: DragType) => {
    e.preventDefault();
    const { x, y } = getStartPos(type);
    drag.current = { type, startClientX: e.clientX, startClientY: e.clientY, startXmm: x, startYmm: y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent, type: DragType) => {
    if (!drag.current || drag.current.type !== type) return;
    const newX = drag.current.startXmm + xPxToMm(e.clientX - drag.current.startClientX);
    const newY = drag.current.startYmm + yPxToMm(e.clientY - drag.current.startClientY);
    const cx = (v: number) => Math.max(0, Math.min(CARD_W_MM, v));
    const cy = (v: number) => Math.max(0, Math.min(CARD_H_MM, v));

    if (type === 'name')
      onOverlaysChange({ ...overlays, name:   { ...overlays.name,   centerXmm: cx(newX), ymm: cy(newY) } });
    else if (type === 'teamId')
      onOverlaysChange({ ...overlays, teamId: { ...overlays.teamId, centerXmm: cx(newX), ymm: cy(newY) } });
    else
      onOverlaysChange({ ...overlays, qr: { ...overlays.qr, xmm: Math.max(0, Math.min(CARD_W_MM - overlays.qr.sizemm, newX)), ymm: Math.max(0, Math.min(CARD_H_MM - overlays.qr.sizemm, newY)) } });
  };

  const handlePointerUp = () => { drag.current = null; };

  const dragStyle: React.CSSProperties = {
    cursor: 'grab', padding: '2px 4px',
    outline: '1.5px dashed rgba(74,222,128,0.75)',
    outlineOffset: '3px', touchAction: 'none',
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>

      {/* ── Card preview ── */}
      <div>
        <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 9l4 4 10-10"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>
          DRAG TO REPOSITION
        </div>

        <div style={{
          position: 'relative', width: previewWidth, height: previewH,
          overflow: 'visible', userSelect: 'none',
          outline: '1px solid rgba(255,255,255,0.12)', outlineOffset: '-1px',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Images/id.svg" alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />

          {/* Draggable Name */}
          <div
            onPointerDown={(e) => handlePointerDown(e, 'name')}
            onPointerMove={(e) => handlePointerMove(e, 'name')}
            onPointerUp={handlePointerUp}
            title="Drag to reposition name"
            style={{
              position: 'absolute',
              left: xMmToPx(overlays.name.centerXmm),
              top:  yMmToPx(overlays.name.ymm),
              transform: 'translate(-50%, -100%)',
              color: '#fff',
              fontFamily: "'HO2', monospace",
              fontWeight: 'normal',
              fontSize: nameFontPx,
              whiteSpace: 'nowrap',
              ...dragStyle,
            }}
          >
            {data.name.toUpperCase()}
          </div>

          {/* Draggable Team ID */}
          {overlays.teamId.show && (
            <div
              onPointerDown={(e) => handlePointerDown(e, 'teamId')}
              onPointerMove={(e) => handlePointerMove(e, 'teamId')}
              onPointerUp={handlePointerUp}
              title="Drag to reposition team ID"
              style={{
                position: 'absolute',
                left: xMmToPx(overlays.teamId.centerXmm),
                top:  yMmToPx(overlays.teamId.ymm),
                transform: 'translate(-50%, -100%)',
                color: '#fff',
                fontFamily: "'HO', monospace",
                fontWeight: 'normal',
                fontSize: teamIdFontPx,
                whiteSpace: 'nowrap',
                opacity: 0.85,
                ...dragStyle,
              }}
            >
              {`Team id - ${data.teamId || 'TEAM-000'}`}
            </div>
          )}

          {/* Draggable QR */}
          <div
            onPointerDown={(e) => handlePointerDown(e, 'qr')}
            onPointerMove={(e) => handlePointerMove(e, 'qr')}
            onPointerUp={handlePointerUp}
            title="Drag to reposition QR code"
            style={{
              position: 'absolute',
              left:   xMmToPx(overlays.qr.xmm),
              top:    yMmToPx(overlays.qr.ymm),
              width:  xMmToPx(overlays.qr.sizemm),
              height: xMmToPx(overlays.qr.sizemm),
              ...dragStyle,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.qrCodeDataURL} alt="QR" style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} />
          </div>

          {/* Centerline guide */}
          <div style={{
            position: 'absolute',
            left: xMmToPx(overlays.name.centerXmm),
            top: 0, bottom: 0, width: 1,
            backgroundColor: 'rgba(74,222,128,0.15)',
            pointerEvents: 'none',
          }} />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: 10, height: 2, border: '1px dashed rgba(74,222,128,0.75)' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em' }}>DRAGGABLE</span>
          </div>
        </div>

        <div style={{ marginTop: '0.5rem' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em' }}>
            NAME → HO2.ttf &nbsp;|&nbsp; TEAM ID → HO.ttf
          </span>
        </div>
      </div>

      {/* ── Controls panel ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '200px', flex: 1 }}>

        <ControlGroup label="NAME TEXT  (HO2.ttf)">
          <SliderControl label="CENTER X" unit="mm" value={overlays.name.centerXmm} min={0} max={CARD_W_MM} step={0.1}
            onChange={(v) => onOverlaysChange({ ...overlays, name: { ...overlays.name, centerXmm: v } })} />
          <SliderControl label="Y (BASELINE)" unit="mm" value={overlays.name.ymm} min={0} max={CARD_H_MM} step={0.1}
            onChange={(v) => onOverlaysChange({ ...overlays, name: { ...overlays.name, ymm: v } })} />
          <SliderControl label="FONT SIZE" unit="pt" value={overlays.name.fontSizePt} min={4} max={22} step={0.5}
            onChange={(v) => onOverlaysChange({ ...overlays, name: { ...overlays.name, fontSizePt: v } })} />
        </ControlGroup>

        <ControlGroup label="TEAM ID  (HO.ttf)">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.07em' }}>SHOW ON CARD</span>
            <button
              onClick={() => onOverlaysChange({ ...overlays, teamId: { ...overlays.teamId, show: !overlays.teamId.show } })}
              style={{
                width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                position: 'relative', transition: 'background 0.2s',
                backgroundColor: overlays.teamId.show ? '#4ade80' : 'rgba(255,255,255,0.15)',
              }}
            >
              <div style={{
                position: 'absolute', top: 3,
                left: overlays.teamId.show ? 18 : 3,
                width: 14, height: 14, borderRadius: '50%',
                backgroundColor: '#fff', transition: 'left 0.2s',
              }} />
            </button>
          </div>

          {overlays.teamId.show && (
            <>
              <SliderControl label="CENTER X" unit="mm" value={overlays.teamId.centerXmm} min={0} max={CARD_W_MM} step={0.1}
                onChange={(v) => onOverlaysChange({ ...overlays, teamId: { ...overlays.teamId, centerXmm: v } })} />
              <SliderControl label="Y (BASELINE)" unit="mm" value={overlays.teamId.ymm} min={0} max={CARD_H_MM} step={0.1}
                onChange={(v) => onOverlaysChange({ ...overlays, teamId: { ...overlays.teamId, ymm: v } })} />
              <SliderControl label="FONT SIZE" unit="pt" value={overlays.teamId.fontSizePt} min={4} max={18} step={0.5}
                onChange={(v) => onOverlaysChange({ ...overlays, teamId: { ...overlays.teamId, fontSizePt: v } })} />
            </>
          )}
        </ControlGroup>

        <ControlGroup label="QR CODE">
          <SliderControl label="X (LEFT EDGE)" unit="mm" value={overlays.qr.xmm} min={0} max={CARD_W_MM} step={0.1}
            onChange={(v) => onOverlaysChange({ ...overlays, qr: { ...overlays.qr, xmm: v } })} />
          <SliderControl label="Y (TOP EDGE)" unit="mm" value={overlays.qr.ymm} min={0} max={CARD_H_MM} step={0.1}
            onChange={(v) => onOverlaysChange({ ...overlays, qr: { ...overlays.qr, ymm: v } })} />
          <SliderControl label="SIZE" unit="mm" value={overlays.qr.sizemm} min={6} max={30} step={0.5}
            onChange={(v) => onOverlaysChange({ ...overlays, qr: { ...overlays.qr, sizemm: v } })} />
        </ControlGroup>

        <button
          onClick={() => onOverlaysChange(DEFAULT_OVERLAYS)}
          style={{
            padding: '0.5rem 1rem', backgroundColor: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)',
            fontFamily: 'monospace', fontSize: '0.65rem', cursor: 'pointer',
            letterSpacing: '0.08em', transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
        >
          ↺ RESET TO DEFAULT
        </button>

        <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', lineHeight: 1.7, padding: '0.75rem', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <div style={{ color: 'rgba(255,255,255,0.35)', marginBottom: '0.35rem', letterSpacing: '0.06em' }}>CURRENT VALUES (MM)</div>
          <div>name.centerX   = {overlays.name.centerXmm.toFixed(2)}</div>
          <div>name.y         = {overlays.name.ymm.toFixed(2)}</div>
          <div>name.size      = {overlays.name.fontSizePt.toFixed(1)}pt  <span style={{ opacity: 0.5 }}>[HO2]</span></div>
          <div style={{ marginTop: '0.35rem' }}>teamId.centerX = {overlays.teamId.centerXmm.toFixed(2)}</div>
          <div>teamId.y       = {overlays.teamId.ymm.toFixed(2)}</div>
          <div>teamId.size    = {overlays.teamId.fontSizePt.toFixed(1)}pt  <span style={{ opacity: 0.5 }}>[HO]</span></div>
          <div>teamId.show    = {overlays.teamId.show ? 'true' : 'false'}</div>
          <div style={{ marginTop: '0.35rem' }}>qr.x    = {overlays.qr.xmm.toFixed(2)}</div>
          <div>qr.y    = {overlays.qr.ymm.toFixed(2)}</div>
          <div>qr.size = {overlays.qr.sizemm.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.08)', padding: '0.875rem' }}>
      <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function SliderControl({
  label, value, unit, onChange, min, max, step,
}: {
  label: string; value: number; unit: string;
  onChange: (v: number) => void;
  min: number; max: number; step: number;
}) {
  return (
    <div style={{ marginBottom: '0.625rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.07em' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'rgba(255,255,255,0.65)' }}>
          {value.toFixed(1)}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#4ade80', cursor: 'pointer', height: '3px' }}
      />
    </div>
  );
}