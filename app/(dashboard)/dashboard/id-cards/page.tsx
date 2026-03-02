'use client';

import { useState, useRef } from 'react';
import IDCardEditor, { IDCardCard, CardOverlays, DEFAULT_OVERLAYS } from '@/components/id-card/IDCardEditor';
import { IDCardData, HackathonInfo } from '@/types';
import { parseCSVForIDCards } from '@/lib/csv';
import { downloadCSVTemplate } from '@/utils/csv-download';
import { getParticipants } from '@/actions/participants';
import { generateQRCode } from '@/utils/generate-qr';
import { generateBulkVectorPDFs, generateGridPDF, GRID_CARD_W, GRID_CARD_H, GRID_GAP, CARDS_PER_PAGE } from '@/utils/generate-pdf';

interface SelectableIDCardData extends IDCardData {
  selected: boolean;
}

const PLACEHOLDER_QR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const SAMPLE_CARD: IDCardData = {
  name: 'JOHN DOE',
  email: 'john.doe@example.com',
  role: 'Participant',
  company: 'N/A',
  phone: '',
  participantId: 'PART-0000',
  qrCodeDataURL: PLACEHOLDER_QR,
  teamId: 'TEAM-001',
};

type DownloadFormat = 'pdf' | 'grid';

const FORMAT_META: Record<DownloadFormat, { label: string; sub: string; desc: string }> = {
  pdf: {
    label: 'PDF',
    sub:   'INDIVIDUAL',
    desc:  'One PDF per card — zipped',
  },
  grid: {
    label: 'GRID PDF',
    sub:   'A4 SHEET',
    desc:  `${GRID_CARD_W/10}×${GRID_CARD_H/10} cm · 4 cards/page · cut guides`,
  },
};

// A4 dimensions for the page-preview widget
const A4_W_MM  = 210;
const A4_H_MM  = 297;
const BLOCK_W  = 2 * GRID_CARD_W + GRID_GAP;        // 175 mm
const BLOCK_H  = 2 * GRID_CARD_H + GRID_GAP;        // 225 mm
const MARGIN_X = (A4_W_MM - BLOCK_W) / 2;           // 17.5 mm
const MARGIN_Y = (A4_H_MM - BLOCK_H) / 2;           // 36.0 mm

export default function GeneratorPage() {
  const [cards, setCards]               = useState<SelectableIDCardData[]>([]);
  const [overlays, setOverlays]         = useState<CardOverlays>(DEFAULT_OVERLAYS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress]         = useState(0);
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>('grid');
  const [fileName, setFileName]         = useState('');
  const [status, setStatus]             = useState('');
  const [searchQuery, setSearchQuery]   = useState('');
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const hackathonInfo: HackathonInfo = {
    name: 'HACKOVERFLOW 4.0',
    date: 'March 15-16, 2026',
    venue: 'Pillai HOC College, Rasayani',
  };

  const editorCard: IDCardData = cards.length > 0 ? cards[0] : SAMPLE_CARD;

  // ── Loaders ──────────────────────────────────────────────────────────────────
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const processed = await parseCSVForIDCards(text);
      setCards(processed.map(c => ({ ...c, selected: true })));
      setStatus(`Loaded ${processed.length} participants successfully`);
    } catch (err) {
      setStatus('Error processing CSV. Please check the format.');
      console.error(err);
    }
  };

  const loadParticipants = async () => {
    try {
      setStatus('Loading participants from database...');
      const db = await getParticipants();
      const transformed: SelectableIDCardData[] = await Promise.all(
        db.map(async (p) => ({
          name:          p.name,
          email:         p.email,
          role:          p.role || 'Participant',
          company:       p.institute || 'N/A',
          phone:         p.phone || '',
          participantId: p.participantId,
          qrCodeDataURL: await generateQRCode(p.participantId),
          teamId:        p.teamId,
          selected:      true,
        }))
      );
      setCards(transformed);
      setStatus(`Loaded ${transformed.length} participants from database`);
    } catch (err) {
      setStatus('Error loading participants from database');
      console.error(err);
    }
  };

  // ── Selection ────────────────────────────────────────────────────────────────
  const toggleParticipant = (i: number) =>
    setCards(prev => prev.map((c, idx) => idx === i ? { ...c, selected: !c.selected } : c));

  const toggleAll = (sel: boolean) =>
    setCards(prev => prev.map(c => ({ ...c, selected: sel })));

  // ── Generation ───────────────────────────────────────────────────────────────
  const generateIndividualPDFs = async () => {
    const selected = cards.filter(c => c.selected);
    if (!selected.length) { setStatus('Please select at least one participant'); return; }
    setIsGenerating(true); setProgress(0);
    try {
      await generateBulkVectorPDFs(
        selected, hackathonInfo, 'id-cards',
        (cur, tot) => setProgress(Math.round((cur / tot) * 100)),
        overlays,
      );
      setStatus(`Generated ${selected.length} individual PDF cards`);
    } catch (err) {
      setStatus('Error generating PDF cards. Please try again.');
      console.error(err);
    } finally { setIsGenerating(false); setProgress(0); }
  };

  const generateGrid = async () => {
    const selected = cards.filter(c => c.selected);
    if (!selected.length) { setStatus('Please select at least one participant'); return; }
    setIsGenerating(true); setProgress(0);
    try {
      const pageCount = Math.ceil(selected.length / CARDS_PER_PAGE);
      await generateGridPDF(
        selected, hackathonInfo, 'id-cards-grid.pdf',
        (cur, tot) => setProgress(Math.round((cur / tot) * 100)),
        overlays,
      );
      setStatus(
        `Generated grid PDF: ${selected.length} cards across ${pageCount} A4 page${pageCount !== 1 ? 's' : ''} ` +
        `(${GRID_CARD_W/10}×${GRID_CARD_H/10} cm, ${GRID_GAP}mm gap, 4 per page)`
      );
    } catch (err) {
      setStatus('Error generating grid PDF. Please try again.');
      console.error(err);
    } finally { setIsGenerating(false); setProgress(0); }
  };

  const handleGenerate = () => downloadFormat === 'grid' ? generateGrid() : generateIndividualPDFs();

  const selectedCount = cards.filter(c => c.selected).length;
  const pageCount     = Math.ceil(selectedCount / CARDS_PER_PAGE);

  const filteredCards = cards.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.participantId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.teamId  && c.teamId.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.role    && c.role.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.company && c.company.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ padding: '3rem' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 900, letterSpacing: '-0.05em', marginBottom: '0.5rem' }}>
          ID CARD GENERATOR
        </h1>
        <p style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)', fontSize: '1rem' }}>
          Upload CSV, position overlays, and generate professional ID cards in bulk
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>

        {/* ── 1. Import ── */}
        <Section label="1. IMPORT PARTICIPANTS">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <IconButton onClick={loadParticipants} label="LOAD FROM DATABASE">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </IconButton>
            <IconButton onClick={() => downloadCSVTemplate('id-card')} label="DOWNLOAD TEMPLATE">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </IconButton>
          </div>

          <div style={{ position: 'relative' }}>
            <input type="file" accept=".csv" onChange={handleFileUpload}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
              id="csv-upload"
            />
            <label htmlFor="csv-upload"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.2)', padding: '2rem 1rem', cursor: 'pointer', transition: 'all 0.3s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '0.75rem', opacity: 0.5 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.25rem' }}>
                {fileName || 'Upload CSV File'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
                {cards.length > 0 ? `${cards.length} participants loaded` : 'Click to browse or drag and drop'}
              </div>
            </label>
          </div>
        </Section>

        {/* ── 2. Position Overlays ── */}
        <Section label="2. POSITION CARD ELEMENTS">
          <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '1.25rem' }}>
            Drag the name, team ID or QR code to the correct position. Adjustments apply to all generated cards.
            {cards.length === 0 && ' (Load participants to preview with real data)'}
          </p>
          <IDCardEditor data={editorCard} overlays={overlays} onOverlaysChange={setOverlays} previewWidth={310} />
        </Section>

        {/* ── 3. Select Participants ── */}
        {cards.length > 0 && (
          <Section label="3. SELECT PARTICIPANTS">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <GhostButton onClick={() => toggleAll(true)}>SELECT ALL</GhostButton>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
                <GhostButton onClick={() => toggleAll(false)}>DESELECT ALL</GhostButton>
              </div>
            </div>

            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, team ID, participant ID..."
                style={{ width: '100%', boxSizing: 'border-box', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem 0.75rem 0.5rem 2.5rem', color: '#fff', fontFamily: 'monospace', fontSize: '0.75rem' }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'}
                onBlur={(e)  => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', maxHeight: '20rem', overflowY: 'auto' }}>
              {filteredCards.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  No results found
                </div>
              ) : filteredCards.map((card) => {
                const idx = cards.findIndex(c => c.participantId === card.participantId);
                return (
                  <div key={idx} onClick={() => toggleParticipant(idx)}
                    style={{ border: `1px solid ${card.selected ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'}`, padding: '0.875rem 1rem', cursor: 'pointer', backgroundColor: card.selected ? 'rgba(255,255,255,0.04)' : 'transparent', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                    onMouseEnter={(e) => { if (!card.selected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                    onMouseLeave={(e) => { if (!card.selected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                  >
                    <div style={{ width: 14, height: 14, border: `1px solid ${card.selected ? '#fff' : 'rgba(255,255,255,0.3)'}`, backgroundColor: card.selected ? '#fff' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                      {card.selected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {card.name}
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span>{card.participantId}</span>
                        {card.teamId && <span style={{ color: 'rgba(74,222,128,0.7)' }}>{card.teamId}</span>}
                        <span style={{ opacity: 0.7 }}>{card.email}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '0.875rem', fontFamily: 'monospace', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
              {selectedCount} of {cards.length} selected
              {searchQuery && filteredCards.length !== cards.length && (
                <span style={{ color: 'rgba(255,255,255,0.25)' }}> ({filteredCards.length} shown)</span>
              )}
            </div>
          </Section>
        )}

        {/* ── 4. Format & Generate ── */}
        <Section label={cards.length > 0 ? '4. GENERATE' : '3. GENERATE'}>

          {/* Format selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {(Object.entries(FORMAT_META) as [DownloadFormat, typeof FORMAT_META[DownloadFormat]][]).map(([fmt, meta]) => {
              const active = downloadFormat === fmt;
              return (
                <button key={fmt} onClick={() => setDownloadFormat(fmt)}
                  style={{ padding: '0.875rem 1rem', border: `1px solid ${active ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)'}`, background: active ? 'rgba(255,255,255,0.08)' : 'transparent', color: '#fff', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', position: 'relative' }}
                  onMouseEnter={(e) => { if (!active) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; } }}
                  onMouseLeave={(e) => { if (!active) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.background = 'transparent'; } }}
                >
                  {active && (
                    <div style={{ position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4ade80' }} />
                  )}
                  <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.8rem', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>
                    {meta.label}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.55rem', color: active ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)', letterSpacing: '0.06em' }}>
                    {meta.sub}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: active ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)', marginTop: '0.35rem', lineHeight: 1.5 }}>
                    {meta.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Grid info banner */}
          {downloadFormat === 'grid' && selectedCount > 0 && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', border: '1px solid rgba(74,222,128,0.2)', backgroundColor: 'rgba(74,222,128,0.04)', fontFamily: 'monospace', fontSize: '0.7rem', color: 'rgba(74,222,128,0.8)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <span>A4 PORTRAIT</span>
              <span>2 × 2 GRID</span>
              <span>{GRID_CARD_W/10} × {GRID_CARD_H/10} CM / CARD</span>
              <span>{GRID_GAP}MM GAP</span>
              <span>{selectedCount} CARDS → {pageCount} PAGE{pageCount !== 1 ? 'S' : ''}</span>
              <span>CUT GUIDES INCLUDED</span>
            </div>
          )}

          {/* Generate button */}
          <button onClick={handleGenerate}
            disabled={isGenerating || selectedCount === 0}
            style={{ width: '100%', padding: '1rem', fontWeight: 900, fontSize: '1.125rem', background: selectedCount === 0 || isGenerating ? 'rgba(255,255,255,0.08)' : '#fff', color: selectedCount === 0 || isGenerating ? 'rgba(255,255,255,0.3)' : '#000', cursor: selectedCount === 0 || isGenerating ? 'not-allowed' : 'pointer', border: 'none', transition: 'all 0.3s', letterSpacing: '0.05em' }}
            onMouseEnter={(e) => { if (!isGenerating && selectedCount > 0) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.9)'; }}
            onMouseLeave={(e) => { if (!isGenerating && selectedCount > 0) e.currentTarget.style.backgroundColor = '#fff'; }}
          >
            {isGenerating
              ? `GENERATING... ${progress}%`
              : selectedCount === 0
                ? 'SELECT PARTICIPANTS FIRST'
                : downloadFormat === 'grid'
                  ? `GENERATE GRID PDF  ·  ${selectedCount} CARDS  ·  ${pageCount} PAGE${pageCount !== 1 ? 'S' : ''}`
                  : `GENERATE ${selectedCount} INDIVIDUAL PDF${selectedCount !== 1 ? 'S' : ''}`}
          </button>

          {isGenerating && (
            <div style={{ marginTop: '1rem', height: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#4ade80', width: `${progress}%`, transition: 'width 0.3s' }} />
            </div>
          )}
        </Section>

        {/* ── Status ── */}
        {status && (
          <div style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '0.875rem 1rem', backgroundColor: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{status}</div>
          </div>
        )}

        {/* ── Preview Grid ── */}
        <Section label={`PREVIEW CARDS (${cards.length})`}>
          {cards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', fontSize: '0.875rem' }}>
              No participants loaded
            </div>
          ) : (
            <>
              {/* A4 page layout preview when grid mode is active */}
              {downloadFormat === 'grid' && selectedCount > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                    A4 PAGE PREVIEW  ·  {GRID_CARD_W/10}×{GRID_CARD_H/10} CM CARDS  ·  {GRID_GAP}MM GAP
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {Array.from({ length: pageCount }).map((_, pi) => {
                      const pageSelectedCards = cards.filter(c => c.selected).slice(pi * CARDS_PER_PAGE, (pi + 1) * CARDS_PER_PAGE);
                      // Scale A4 to a preview widget ~190px wide
                      const previewW  = 190;
                      const scale     = previewW / A4_W_MM;
                      const previewH  = A4_H_MM * scale;
                      const slotW     = GRID_CARD_W  * scale;
                      const slotH     = GRID_CARD_H  * scale;
                      const gapPx     = GRID_GAP     * scale;
                      const mxPx      = MARGIN_X     * scale;
                      const myPx      = MARGIN_Y     * scale;

                      return (
                        <div key={pi} style={{ position: 'relative', width: previewW, height: previewH, border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>

                          {/* Cut guide lines */}
                          {[0, 1].map(c => {
                            const x1 = mxPx + c * (slotW + gapPx);
                            const x2 = x1 + slotW;
                            return [x1, x2].map((x, xi) => (
                              <div key={`vg-${c}-${xi}`} style={{ position: 'absolute', left: x, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(200,200,200,0.12)' }} />
                            ));
                          })}
                          {[0, 1].map(r => {
                            const y1 = myPx + r * (slotH + gapPx);
                            const y2 = y1 + slotH;
                            return [y1, y2].map((y, yi) => (
                              <div key={`hg-${r}-${yi}`} style={{ position: 'absolute', left: 0, right: 0, top: y, height: 1, backgroundColor: 'rgba(200,200,200,0.12)' }} />
                            ));
                          })}

                          {/* Card slots */}
                          {Array.from({ length: CARDS_PER_PAGE }).map((_, slot) => {
                            const col  = slot % 2;
                            const row  = Math.floor(slot / 2);
                            const card = pageSelectedCards[slot];
                            return (
                              <div key={slot} style={{
                                position: 'absolute',
                                left:   mxPx + col * (slotW + gapPx),
                                top:    myPx + row * (slotH + gapPx),
                                width:  slotW, height: slotH,
                                backgroundColor: card ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${card ? 'rgba(74,222,128,0.22)' : 'rgba(255,255,255,0.05)'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                              }}>
                                {card ? (
                                  <span style={{ fontFamily: 'monospace', fontSize: '0.38rem', color: 'rgba(255,255,255,0.55)', textAlign: 'center', padding: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
                                    {card.name.split(' ')[0]}
                                  </span>
                                ) : (
                                  <span style={{ fontFamily: 'monospace', fontSize: '0.35rem', color: 'rgba(255,255,255,0.12)' }}>EMPTY</span>
                                )}
                              </div>
                            );
                          })}

                          {/* Page label */}
                          <div style={{ position: 'absolute', bottom: 3, right: 5, fontFamily: 'monospace', fontSize: '0.4rem', color: 'rgba(255,255,255,0.2)' }}>
                            PG {pi + 1}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Card thumbnails */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', maxHeight: '600px', overflowY: 'auto', padding: '0.25rem' }}>
                {cards.map((card, i) => {
                  const RENDER_W  = 400;
                  const DISPLAY_W = 160;
                  const scale     = DISPLAY_W / RENDER_W;
                  return (
                    <div key={i}
                      style={{ position: 'relative', width: DISPLAY_W, height: DISPLAY_W * (74.98 / 60.02), overflow: 'hidden', border: `1px solid ${card.selected ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.06)'}`, transition: 'border-color 0.2s', cursor: 'pointer' }}
                      onClick={() => toggleParticipant(i)}
                      title={card.selected ? 'Click to deselect' : 'Click to select'}
                    >
                      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                        <IDCardCard
                          ref={(el) => { cardRefs.current[i] = el; }}
                          data={card} overlays={overlays} width={RENDER_W} dimmed={!card.selected}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Section>

      </div>
    </div>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '1.5rem', transition: 'border-color 0.3s' }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
    >
      <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', marginBottom: '1.25rem' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function IconButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.2)', padding: '1.5rem 1rem', cursor: 'pointer', transition: 'all 0.3s', backgroundColor: 'transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '0.5rem', opacity: 0.55 }}>
        {children}
      </svg>
      <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.07em' }}>
        {label}
      </div>
    </button>
  );
}

function GhostButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', letterSpacing: '0.06em', transition: 'color 0.2s' }}
      onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
      onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
    >
      {children}
    </button>
  );
}