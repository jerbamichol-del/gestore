import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DateRangePickerModal } from './DateRangePickerModal';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { useSwipe } from '../hooks/useSwipe';
import SmoothPullTab from './SmoothPullTab';
import { useTapBridge } from '../hooks/useTapBridge';

type DateFilter = 'all' | '7d' | '30d' | '6m' | '1y';
type PeriodType = 'day' | 'week' | 'month' | 'year';

interface HistoryFilterCardProps {
  onSelectQuickFilter: (value: DateFilter) => void;
  currentQuickFilter: DateFilter;
  onCustomRangeChange: (range: { start: string | null, end: string | null }) => void;
  currentCustomRange: { start: string | null, end: string | null };
  isCustomRangeActive: boolean;
  onDateModalStateChange: (isOpen: boolean) => void;
  isActive: boolean; // true SOLO nella pagina "Storico"
  onSelectPeriodType: (type: PeriodType) => void;
  onSetPeriodDate: (date: Date) => void;
  periodType: PeriodType;
  periodDate: Date;
  onActivatePeriodFilter: () => void;
  isPeriodFilterActive: boolean;
}

/* ---------- QuickFilterControl (NIENTE stopPropagation qui) ---------- */
const QuickFilterControl: React.FC<{
  onSelect: (value: DateFilter) => void;
  currentValue: DateFilter;
  isActive: boolean;
}> = ({ onSelect, currentValue, isActive }) => {
  const filters: { value: DateFilter; label: string }[] = [
    { value: '7d', label: '7G' },
    { value: '30d', label: '30G' },
    { value: '6m', label: '6M' },
    { value: '1y', label: '1A' },
  ];
  return (
    <div className={`w-full h-10 flex border rounded-lg overflow-hidden transition-colors ${isActive ? 'border-indigo-600' : 'border-slate-400'}`}>
      {filters.map((f, i) => {
        const active = isActive && currentValue === f.value;
        return (
          <button
            key={f.value}
            onClick={() => onSelect(f.value)}
            // niente e.stopPropagation: consente allo swipe orizzontale di catturare il gesto
            style={{ touchAction: 'none' }}
            className={`flex-1 flex items-center justify-center px-2 text-center font-semibold text-sm transition-colors duration-200 focus:outline-none
              ${i > 0 ? 'border-l' : ''}
              ${active ? 'bg-indigo-600 text-white border-indigo-600'
                       : `bg-slate-100 text-slate-700 hover:bg-slate-200 ${isActive ? 'border-indigo-600' : 'border-slate-400'}`}`}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
};

/* -------------------- CustomDateRangeInputs -------------------- */
const fmtBtn = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: '2-digit' })
    .format(new Date(y, m - 1, d))
    .replace('.', '');
};

const CustomDateRangeInputs: React.FC<{
  onClick: () => void;
  range: { start: string | null; end: string | null };
  isActive: boolean;
}> = ({ onClick, range, isActive }) => {
  const has = !!(range.start && range.end);
  const txt = has ? `${fmtBtn(range.start!)} - ${fmtBtn(range.end!)}` : 'Imposta periodo';
  return (
    <div className={`border h-10 transition-colors rounded-lg ${isActive ? 'border-indigo-600' : 'border-slate-400'}`}>
      <button
        onClick={onClick}
        style={{ touchAction: 'none' }} // consente swipe orizzontale gestito via JS
        className={`w-full h-full flex items-center justify-center gap-2 px-2 hover:bg-slate-200 transition-colors focus:outline-none rounded-lg ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}
        aria-label="Seleziona intervallo di date"
      >
        <span className="text-sm font-semibold">{txt}</span>
      </button>
    </div>
  );
};

/* -------------------- PeriodNavigator -------------------- */
const PeriodNavigator: React.FC<{
  periodType: PeriodType;
  periodDate: Date;
  onTypeChange: (type: PeriodType) => void;
  onDateChange: (date: Date) => void;
  isActive: boolean;
  onActivate: () => void;
  isMenuOpen: boolean;
  onMenuToggle: (isOpen: boolean) => void;
}> = ({ periodType, periodDate, onTypeChange, onDateChange, isActive, onActivate, isMenuOpen, onMenuToggle }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (ev: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(ev.target as Node)) onMenuToggle(false);
    };
    if (isMenuOpen) document.addEventListener('pointerdown', handler, { capture: true });
    return () => document.removeEventListener('pointerdown', handler as any, { capture: true } as any);
  }, [isMenuOpen, onMenuToggle]);

  const step = (sign: 1 | -1) => {
    onActivate();
    const d = new Date(periodDate);
    if (periodType === 'day') d.setDate(d.getDate() + sign);
    else if (periodType === 'week') d.setDate(d.getDate() + 7 * sign);
    else if (periodType === 'month') d.setMonth(d.getMonth() + sign);
    else d.setFullYear(d.getFullYear() + sign);
    onDateChange(d);
  };

  const label = (() => {
    const t = new Date(); t.setHours(0,0,0,0);
    const s = new Date(periodDate); s.setHours(0,0,0,0);
    if (periodType === 'day') {
      if (+s === +t) return 'Oggi';
      const y = new Date(t); y.setDate(t.getDate() - 1);
      if (+s === +y) return 'Ieri';
      return periodDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
    }
    if (periodType === 'month') {
      const cm = t.getMonth(), cy = t.getFullYear();
      if (periodDate.getMonth() === cm && periodDate.getFullYear() === cy) return 'Questo Mese';
      const pm = cm === 0 ? 11 : cm - 1; const py = cm === 0 ? cy - 1 : cy;
      if (periodDate.getMonth() === pm && periodDate.getFullYear() === py) return 'Mese Scorso';
      return periodDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    }
    if (periodType === 'year') {
      if (periodDate.getFullYear() === t.getFullYear()) return "Quest'Anno";
      if (periodDate.getFullYear() === t.getFullYear() - 1) return 'Anno Scorso';
      return String(periodDate.getFullYear());
    }
    // week
    const sow = new Date(periodDate); const day = sow.getDay(); const diff = sow.getDate() - day + (day === 0 ? -6 : 1);
    sow.setDate(diff); sow.setHours(0,0,0,0);
    const eow = new Date(sow); eow.setDate(sow.getDate() + 6);
    const tsow = new Date(t); const tday = tsow.getDay(); const tdiff = tsow.getDate() - tday + (tday === 0 ? -6 : 1);
    tsow.setDate(tdiff); tsow.setHours(0,0,0,0);
    if (+sow === +tsow) return 'Questa Settimana';
    const last = new Date(tsow); last.setDate(tsow.getDate() - 7);
    if (+sow === +last) return 'Settimana Scorsa';
    return `${sow.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - ${eow.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  })();

  return (
    <div ref={wrapperRef} className={`w-full h-10 flex items-center justify-between border rounded-lg bg-white ${isActive ? 'border-indigo-600' : 'border-slate-400'}`}>
      <button onClick={() => step(-1)} style={{ touchAction: 'none' }} className="h-full px-4 hover:bg-slate-100 rounded-l-lg" aria-label="Periodo precedente">
        <ChevronLeftIcon className="w-5 h-5 text-slate-700" />
      </button>
      <button onClick={() => onMenuToggle(!isMenuOpen)} style={{ touchAction: 'none' }} className={`flex-1 h-full text-sm font-semibold ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'} hover:bg-slate-200`}>
        {label}
      </button>
      <button onClick={() => step(+1)} style={{ touchAction: 'none' }} className="h-full px-4 hover:bg-slate-100 rounded-r-lg" aria-label="Periodo successivo">
        <ChevronRightIcon className="w-5 h-5 text-slate-700" />
      </button>

      {isMenuOpen && (
        <div className="absolute bottom-full mb-2 left-0 right-0 mx-auto w-40 bg-white border border-slate-200 shadow-lg rounded-lg z-[1000] p-2 space-y-1">
          {(['day','week','month','year'] as PeriodType[]).map(v => (
            <button key={v} onClick={() => { onActivate(); onTypeChange(v); onMenuToggle(false); }} style={{ touchAction: 'none' }} className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-lg ${periodType === v ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-50 text-slate-800 hover:bg-slate-200'}`}>
              {v === 'day' ? 'Giorno' : v === 'week' ? 'Settimana' : v === 'month' ? 'Mese' : 'Anno'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* -------------------- HistoryFilterCard -------------------- */
export const HistoryFilterCard: React.FC<HistoryFilterCardProps> = (props) => {
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);
  const [activeViewIndex, setActiveViewIndex] = useState(0);

  const filterBarRef = useRef<HTMLDivElement>(null);
  const tapBridge = useTapBridge();

  // misura pannello
  const OPEN_HEIGHT_VH = 40;
  const [openHeight, setOpenHeight] = useState(0);
  const [peekHeight, setPeekHeight] = useState(0);
  const [laidOut, setLaidOut] = useState(false);

  // stato drag verticale
  const gs = useRef({
    isDragging: false, isLocked: false,
    startX: 0, startY: 0, lastY: 0, lastT: 0,
    startTranslateY: 0, pointerId: null as number | null,
  });

  const OPEN_Y = 0;
  const CLOSED_Y = openHeight > peekHeight ? openHeight - peekHeight : 0;
  const [translateY, setTranslateY] = useState(0);
  const [anim, setAnim] = useState(false);

  // notifica parent
  useEffect(() => { props.onDateModalStateChange?.(isDateModalOpen); }, [isDateModalOpen, props.onDateModalStateChange]);

  const setCardY = useCallback((y: number, animated: boolean) => { setAnim(animated); setTranslateY(y); }, []);

  // layout solo quando Storico è attivo
  useEffect(() => {
    if (!props.isActive) { setLaidOut(false); return; }
    const update = () => {
      if (!filterBarRef.current || gs.current.isDragging) return;
      const vh = window.innerHeight / 100;
      const oh = OPEN_HEIGHT_VH * vh;
      const ph = filterBarRef.current.offsetHeight || 0;
      const closed = oh - ph;
      setOpenHeight(oh); setPeekHeight(ph);
      if (!laidOut) { setCardY(closed, false); setLaidOut(true); } else { setTranslateY(cur => (cur < closed * 0.9 ? OPEN_Y : closed)); setAnim(false); }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [props.isActive, laidOut, setCardY]);

  // blocco scroll sotto quando pannello è davvero aperto
  const overlayOpen = props.isActive && laidOut && translateY <= Math.max(0, CLOSED_Y - 1);
  useEffect(() => {
    if (!overlayOpen) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = prev; };
  }, [overlayOpen]);

  // sblocco fail-safe
  useEffect(() => {
    const unlock = () => { gs.current.isDragging = false; gs.current.isLocked = false; gs.current.pointerId = null; };
    window.addEventListener('pointerup', unlock, { capture: true });
    window.addEventListener('pointercancel', unlock, { capture: true });
    return () => {
      window.removeEventListener('pointerup', unlock as any, { capture: true } as any);
      window.removeEventListener('pointercancel', unlock as any, { capture: true } as any);
    };
  }, []);

  // flick veloce per aprire/chiudere
  const SPEED = 0.18; // px/ms
  const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const clamp = (y: number) => Math.round(Math.max(OPEN_Y, Math.min(CLOSED_Y, y)) * DPR) / DPR;

  /* ---------- TapBridge + drag verticale (in capture sul pannello) ---------- */
  const onPD = (e: React.PointerEvent) => {
    tapBridge.onPointerDown(e);
    if (!props.isActive || isDateModalOpen) return; // 2) chiuso quando calendario aperto
    if (anim || gs.current.pointerId !== null || e.button !== 0) return;
    const now = performance.now();
    gs.current.isDragging = true; gs.current.isLocked = false;
    gs.current.startX = e.clientX; gs.current.startY = e.clientY;
    gs.current.lastY = e.clientY; gs.current.lastT = now;
    gs.current.startTranslateY = translateY; gs.current.pointerId = e.pointerId;
  };
  const onPM = (e: React.PointerEvent) => {
    tapBridge.onPointerMove(e);
    if (!props.isActive || isDateModalOpen) return;
    const S = gs.current;
    if (!S.isDragging || S.pointerId !== e.pointerId) return;
    const dy = e.clientY - S.startY; const dx = e.clientX - S.startX;
    if (!S.isLocked) {
      const SLOP = 6;
      if (Math.abs(dy) < SLOP && Math.abs(dx) < SLOP) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.3) { S.isLocked = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
      else { S.isDragging = false; S.pointerId = null; return; }
    }
    if (e.cancelable) e.preventDefault();
    let y = S.startTranslateY + dy;
    if (y < OPEN_Y) y = OPEN_Y - Math.tanh(-y / 200) * 100;
    if (y > CLOSED_Y) y = CLOSED_Y + Math.tanh((y - CLOSED_Y) / 200) * 100;
    setCardY(y, false);
    S.lastY = e.clientY; S.lastT = performance.now();
  };
  const onPU = (e: React.PointerEvent) => {
    tapBridge.onPointerUp(e);
    if (!props.isActive) return;
    const S = gs.current;
    if (!S.isDragging || S.pointerId !== e.pointerId) return;
    if (S.isLocked) (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    const dt = Math.max(1, performance.now() - S.lastT);
    const vy = (e.clientY - S.lastY) / dt;
    const mid = CLOSED_Y / 2;
    S.isDragging = false; S.isLocked = false; S.pointerId = null;
    const target = vy <= -SPEED ? OPEN_Y : vy >= SPEED ? CLOSED_Y : (translateY < mid ? OPEN_Y : CLOSED_Y);
    setCardY(target, true);
  };
  const onPC = (e: React.PointerEvent) => {
    tapBridge.onPointerCancel?.(e as any);
    const S = gs.current; if (!S.isDragging) return;
    S.isDragging = S.isLocked = false; S.pointerId = null;
    const target = translateY < CLOSED_Y / 2 ? OPEN_Y : CLOSED_Y;
    setCardY(target, true);
  };
  const onClickCap = (e: React.MouseEvent) => { tapBridge.onClickCapture(e as any); };

  /* ---------------- Swipe orizzontale tra i 3 insiemi di filtri ---------------- */
  const swipeWrapperRef = useRef<HTMLDivElement>(null);
  const changeView = useCallback((i: number) => setActiveViewIndex(i), []);
  const { progress, isSwiping } = useSwipe(
    swipeWrapperRef,
    {
      onSwipeLeft: () => changeView(Math.min(2, activeViewIndex + 1)),
      onSwipeRight: () => changeView(Math.max(0, activeViewIndex - 1)),
    },
    {
      enabled: props.isActive && !isPeriodMenuOpen && !isDateModalOpen, // 2) disabilita swipe se calendario aperto
      threshold: 28,
      slop: 8,
      disableDrag: () => gs.current.isLocked, // se stai trascinando in verticale, niente swipe
    }
  );

  const isQuickFilterActive = !props.isPeriodFilterActive && !props.isCustomRangeActive;
  const tx = -activeViewIndex * (100 / 3) + progress * (100 / 3);
  const listTransform = `translateX(${tx}%)`;

  /* ----------------- PORTAL: SOLO in Storico e solo se calendario chiuso ----------------- */
  const panel = (
    <div
      onPointerDownCapture={onPD}
      onPointerMoveCapture={onPM}
      onPointerUpCapture={onPU}
      onPointerCancelCapture={onPC}
      onClickCapture={onClickCap}
      data-no-page-swipe="true"
      className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-8px_20px_-5px_rgba(0,0,0,0.08)] z-[1000]"
      style={{
        height: `${OPEN_HEIGHT_VH}vh`,
        transform: `translate3d(0, ${clamp((openHeight - peekHeight) > 0 ? translateY : openHeight)}px, 0)`,
        transition: anim ? 'transform 0.26s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
        touchAction: 'none',
        backfaceVisibility: 'hidden',
        willChange: 'transform',
      }}
      onTransitionEnd={() => setAnim(false)}
    >
      <div ref={filterBarRef}>
        <div className="pt-2 flex justify-center">
          <SmoothPullTab width="32" height="4" fill="rgb(203 213 225)" />
        </div>

        <div
          ref={swipeWrapperRef}
          className={`relative ${isPeriodMenuOpen ? 'overflow-visible' : 'overflow-hidden'}`}
          style={{ touchAction: 'none' }}  // fondamentale per swipe anche se premi i pulsanti
        >
          <div className="w-[300%] flex" style={{ transform: listTransform, transition: isSwiping ? 'none' : 'transform 0.08s ease-out' }}>
            <div className="w-1/3 px-4 py-1">
              <QuickFilterControl
                onSelect={props.onSelectQuickFilter}
                currentValue={props.currentQuickFilter}
                isActive={isQuickFilterActive}
              />
            </div>

            <div className="w-1/3 px-4 py-1">
              <PeriodNavigator
                periodType={props.periodType}
                periodDate={props.periodDate}
                onTypeChange={props.onSelectPeriodType}
                onDateChange={props.onSetPeriodDate}
                isActive={props.isPeriodFilterActive}
                onActivate={props.onActivatePeriodFilter}
                isMenuOpen={isPeriodMenuOpen}
                onMenuToggle={setIsPeriodMenuOpen}
              />
            </div>

            <div className="w-1/3 px-4 py-1">
              <CustomDateRangeInputs
                onClick={() => setIsDateModalOpen(true)}
                range={props.currentCustomRange}
                isActive={props.isCustomRangeActive}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-center items-center pt-1 pb-2 gap-2">
          {[0,1,2].map(i => (
            <button
              key={i}
              onClick={() => setActiveViewIndex(i)}
              style={{ touchAction: 'none' }}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${activeViewIndex === i ? 'bg-indigo-600' : 'bg-slate-300 hover:bg-slate-400'}`}
              aria-label={`Vai al filtro ${i+1}`}
            />
          ))}
        </div>

        <div style={{ height: `env(safe-area-inset-bottom, 0px)` }} />
      </div>
    </div>
  );

  return (
    <>
      {/* 1) SOLO in "Storico" (isActive) e 2) scompare quando apri il calendario */}
      {props.isActive && !isDateModalOpen && laidOut && createPortal(panel, document.body)}

      <DateRangePickerModal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        initialRange={props.currentCustomRange}
        onApply={(range) => { props.onCustomRangeChange(range); setIsDateModalOpen(false); }}
      />
    </>
  );
};
