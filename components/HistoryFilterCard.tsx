
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { useTapBridge } from '../hooks/useTapBridge';
import SmoothPullTab from './SmoothPullTab';

type DateFilter = 'all' | '7d' | '30d' | '6m' | '1y';
type PeriodType = 'day' | 'week' | 'month' | 'year';

interface HistoryFilterCardProps {
  onSelectQuickFilter: (value: DateFilter) => void;
  currentQuickFilter: DateFilter;
  onCustomRangeChange: (range: { start: string | null; end: string | null }) => void;
  currentCustomRange: { start: string | null; end: string | null };
  isCustomRangeActive: boolean;
  onDateModalStateChange: (isOpen: boolean) => void;
  isActive: boolean; // true SOLO nella pagina "Storico"
  onSelectPeriodType: (type: PeriodType) => void;
  onSetPeriodDate: (date: Date) => void;
  periodType: PeriodType;
  periodDate: Date;
  onActivatePeriodFilter: () => void;
  isPeriodFilterActive: boolean;
  onOpenStateChange: (isOpen: boolean) => void;
}

/* -------------------- QuickFilterControl -------------------- */
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
    <div
      className={
        'w-full h-10 flex border rounded-lg overflow-hidden transition-colors ' +
        (isActive ? 'border-indigo-600' : 'border-slate-400')
      }
    >
      {filters.map((f, i) => {
        const active = isActive && currentValue === f.value;
        return (
          <button
            key={f.value}
            onClick={() => onSelect(f.value)}
            type="button"
            className={
              'flex-1 flex items-center justify-center px-2 text-center font-semibold text-sm transition-colors duration-200 focus:outline-none ' +
              (i > 0 ? 'border-l ' : '') +
              (active
                ? 'bg-indigo-600 text-white border-indigo-600'
                : `bg-slate-100 text-slate-700 hover:bg-slate-200 ${
                    isActive ? 'border-indigo-600' : 'border-slate-400'
                  }`)
            }
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
};

/* -------------------- CustomDateRangeInputs -------------------- */
const CustomDateRangeInputs: React.FC<{
  range: { start: string | null; end: string | null };
  onChange: (range: { start: string | null; end: string | null }) => void;
  isActive: boolean;
}> = ({ range, onChange, isActive }) => {
  const textColor = isActive ? 'text-indigo-700' : 'text-slate-700';
  const textSize = 'text-sm font-semibold';

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      year: '2-digit'
    });
  };

  const handleChange = (field: 'start' | 'end', value: string) => {
      onChange({ ...range, [field]: value || null });
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    // Force show picker on click to ensure responsiveness even if touch events are complex
    try {
      if (typeof (e.currentTarget as any).showPicker === 'function') {
        (e.currentTarget as any).showPicker();
      }
    } catch (err) {
      // Ignore if browser prevents it or doesn't support it
    }
  };

  return (
    <div
      className={
        'w-full h-10 flex border rounded-lg overflow-hidden transition-colors relative ' +
        (isActive ? 'border-indigo-600 bg-indigo-50' : 'border-slate-400 bg-slate-100')
      }
    >
      {/* Start Date Input Wrapper */}
      <label className="relative flex-1 h-full group cursor-pointer block">
         {/* Visual Text (Centered) */}
         <div className={`absolute inset-0 flex items-center justify-center z-0 pointer-events-none ${textSize} ${textColor}`}>
            {range.start ? formatDate(range.start) : 'Dal'}
         </div>
         
         {/* Invisible Native Input on top */}
         <input
          type="date"
          value={range.start || ''}
          onChange={(e) => handleChange('start', e.target.value)}
          onClick={handleInputClick}
          onBlur={(e) => e.target.blur()}
          className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
          style={{ touchAction: 'none' }}
        />
      </label>
      
      <div className={`w-px my-1 ${isActive ? 'bg-indigo-200' : 'bg-slate-300'}`} />
      
      {/* End Date Input Wrapper */}
      <label className="relative flex-1 h-full group cursor-pointer block">
        {/* Visual Text (Centered) */}
        <div className={`absolute inset-0 flex items-center justify-center z-0 pointer-events-none ${textSize} ${textColor}`}>
            {range.end ? formatDate(range.end) : 'Al'}
         </div>
         
         {/* Invisible Native Input on top */}
         <input
          type="date"
          value={range.end || ''}
          onChange={(e) => handleChange('end', e.target.value)}
          onClick={handleInputClick}
          onBlur={(e) => e.target.blur()}
          className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
          style={{ touchAction: 'none' }}
        />
      </label>
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
}> = ({
  periodType,
  periodDate,
  onTypeChange,
  onDateChange,
  isActive,
  onActivate,
  isMenuOpen,
  onMenuToggle,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (ev: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(ev.target as Node)) {
        onMenuToggle(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('pointerdown', handler, { capture: true });
    }
    return () => {
      document.removeEventListener(
        'pointerdown',
        handler as any,
        { capture: true } as any,
      );
    };
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
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const s = new Date(periodDate);
    s.setHours(0, 0, 0, 0);

    if (periodType === 'day') {
      if (+s === +t) return 'Oggi';
      const y = new Date(t);
      y.setDate(t.getDate() - 1);
      if (+s === +y) return 'Ieri';
      return periodDate
        .toLocaleDateString('it-IT', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
        .replace('.', '');
    }

    if (periodType === 'month') {
      const cm = t.getMonth();
      const cy = t.getFullYear();
      if (periodDate.getMonth() === cm && periodDate.getFullYear() === cy)
        return 'Questo Mese';
      const pm = cm === 0 ? 11 : cm - 1;
      const py = cm === 0 ? cy - 1 : cy;
      if (periodDate.getMonth() === pm && periodDate.getFullYear() === py)
        return 'Mese Scorso';
      return periodDate.toLocaleDateString('it-IT', {
        month: 'long',
        year: 'numeric',
      });
    }

    if (periodType === 'year') {
      if (periodDate.getFullYear() === t.getFullYear()) return "Quest'Anno";
      if (periodDate.getFullYear() === t.getFullYear() - 1) return 'Anno Scorso';
      return String(periodDate.getFullYear());
    }

    // week
    const sow = new Date(periodDate);
    const day = sow.getDay();
    const diff = sow.getDate() - day + (day === 0 ? -6 : 1);
    sow.setDate(diff);
    sow.setHours(0, 0, 0, 0);

    const eow = new Date(sow);
    eow.setDate(sow.getDate() + 6);

    const tsow = new Date(t);
    const tday = tsow.getDay();
    const tdiff = tsow.getDate() - tday + (tday === 0 ? -6 : 1);
    tsow.setDate(tdiff);
    tsow.setHours(0, 0, 0, 0);

    if (+sow === +tsow) return 'Questa Settimana';
    const last = new Date(tsow);
    last.setDate(tsow.getDate() - 7);
    if (+sow === +last) return 'Settimana Scorsa';

    return `${sow.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
    })} - ${eow.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
  })();

  return (
    <div
      ref={wrapperRef}
      className={
        'w-full h-10 flex items-center justify-between border rounded-lg bg-white ' +
        (isActive ? 'border-indigo-600' : 'border-slate-400')
      }
    >
      <button
        onClick={() => step(-1)}
        type="button"
        className="h-full px-4 hover:bg-slate-100 rounded-l-lg"
        aria-label="Periodo precedente"
      >
        <ChevronLeftIcon className="w-5 h-5 text-slate-700" />
      </button>
      <button
        onClick={() => onMenuToggle(!isMenuOpen)}
        type="button"
        className={
          'flex-1 h-full text-sm font-semibold ' +
          (isActive
            ? 'bg-indigo-100 text-indigo-700'
            : 'bg-slate-100 text-slate-700') +
          ' hover:bg-slate-200'
        }
      >
        {label}
      </button>
      <button
        onClick={() => step(+1)}
        type="button"
        className="h-full px-4 hover:bg-slate-100 rounded-r-lg"
        aria-label="Periodo successivo"
      >
        <ChevronRightIcon className="w-5 h-5 text-slate-700" />
      </button>

      {isMenuOpen && (
        <div className="absolute bottom-full mb-2 left-0 right-0 mx-auto w-40 bg-white border border-slate-200 shadow-lg rounded-lg z-[1000] p-2 space-y-1">
          {(['day', 'week', 'month', 'year'] as PeriodType[]).map((v) => (
            <button
              key={v}
              onClick={(e) => {
                e.stopPropagation();
                onActivate();
                onTypeChange(v);
                onMenuToggle(false);
              }}
              type="button"
              className={
                'w-full text-left px-4 py-2 text-sm font-semibold rounded-lg ' +
                (isActive && periodType === v
                  ? 'bg-indigo-100 text-indigo-800'
                  : 'bg-slate-50 text-slate-800 hover:bg-slate-200')
              }
            >
              {v === 'day'
                ? 'Giorno'
                : v === 'week'
                ? 'Settimana'
                : v === 'month'
                ? 'Mese'
                : 'Anno'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* -------------------- HistoryFilterCard (bottom sheet) -------------------- */

export const PEEK_PX = 70;

export const HistoryFilterCard: React.FC<HistoryFilterCardProps> = (props) => {
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);
  const [activeViewIndex, setActiveViewIndex] = useState(0);

  const tapBridge = useTapBridge();

  // Altezza pannello e posizione chiusa
  const OPEN_HEIGHT_VH = 40; // pannello aperto = 40% viewport
  const [openHeight, setOpenHeight] = useState(0);
  const [closedY, setClosedY] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [laidOut, setLaidOut] = useState(false);
  const [anim, setAnim] = useState(false);

  // Stato swipe orizzontale
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeAnimating, setIsSwipeAnimating] = useState(false);

  // drag stato unificato (verticale e orizzontale)
  const dragRef = useRef<{
    active: boolean;
    direction: 'none' | 'vertical' | 'horizontal';
    startX: number;
    startY: number;
    startTranslateY: number; // per verticale
    lastY: number;
    lastT: number;
  }>({
    active: false,
    direction: 'none',
    startX: 0,
    startY: 0,
    startTranslateY: 0,
    lastY: 0,
    lastT: 0,
  });

  // misura e calcola posizione chiusa
  useLayoutEffect(() => {
    if (!props.isActive) {
      setLaidOut(false);
      return;
    }

    const update = () => {
      const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
      const oh = (OPEN_HEIGHT_VH / 100) * vh;
      const closed = Math.max(oh - PEEK_PX, 0);

      setOpenHeight(oh);
      setClosedY(closed);

      setTranslateY((prev) => {
        if (!laidOut || prev === 0 || prev === closedY) {
          return closed;
        }
        const wasOpen = prev < closedY / 2;
        return wasOpen ? 0 : closed;
      });

      setLaidOut(true);
    };

    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.isActive]);

  const SPEED = 0.05;
  const MIN_TOGGLE_DRAG = 10; // px minimi per considerare "scatto" apri/chiudi

  const clampY = useCallback(
    (y: number) => {
      const min = 0;
      const max = closedY || 0;
      return Math.max(min, Math.min(max, y));
    },
    [closedY],
  );

  const snapTo = useCallback(
    (vy: number, overridePos?: number) => {
      if (!laidOut) return;
      const max = closedY || 0;
      const currentPos =
        typeof overridePos === 'number' ? clampY(overridePos) : clampY(translateY);
      const ratio = max > 0 ? currentPos / max : 1;

      let target: number;
      if (vy <= -SPEED) {
        // flick deciso verso l'alto -> apri
        target = 0;
      } else if (vy >= SPEED) {
        // flick deciso verso il basso -> chiudi
        target = max;
      } else {
        // niente flick: scegli in base alla posizione
        target = ratio < 0.5 ? 0 : max;
      }

      setAnim(true);
      setTranslateY(target);
    },
    [closedY, translateY, laidOut, SPEED, clampY],
  );

  const isPanelOpen = laidOut && translateY < (closedY || 0) / 2;

  const { onOpenStateChange } = props;
  useEffect(() => {
    onOpenStateChange(isPanelOpen);
  }, [isPanelOpen, onOpenStateChange]);

  // Gestore Pointer Down principale
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!props.isActive) return;

    // Attiviamo SEMPRE TapBridge nel pannello.
    // In questo modo gestiamo correttamente i "tap" anche se focus/stato erano altrove.
    tapBridge.onPointerDown(e as any);

    // 2. Inizializziamo il drag tracker
    dragRef.current = {
      active: true,
      direction: 'none',
      startX: e.clientX,
      startY: e.clientY,
      startTranslateY: translateY,
      lastY: e.clientY,
      lastT: performance.now(),
    };

    if (anim) setAnim(false);
    if (isSwipeAnimating) setIsSwipeAnimating(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    tapBridge.onPointerMove(e as any);
    if (!props.isActive) return;

    const d = dragRef.current;
    if (!d.active) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    // Se non abbiamo ancora deciso la direzione
    if (d.direction === 'none') {
      const dist2 = dx * dx + dy * dy;
      // Soglia minima di movimento (slop)
      if (dist2 < 100) return; 
      
      if (Math.abs(dy) > Math.abs(dx)) {
        d.direction = 'vertical';
      } else {
        // Se menu aperto, non swipare orizzontalmente
        if (isPeriodMenuOpen) {
            d.active = false;
            return;
        }
        d.direction = 'horizontal';
      }
    }

    // Gestione Drag Verticale (Pannello)
    if (d.direction === 'vertical') {
      if (e.cancelable) e.preventDefault();
      const now = performance.now();
      const newY = clampY(d.startTranslateY + dy);
      setTranslateY(newY);
      d.lastY = e.clientY;
      d.lastT = now;
    }
    
    // Gestione Drag Orizzontale (Filtri)
    else if (d.direction === 'horizontal') {
       if (e.cancelable) e.preventDefault();
       setSwipeOffset(dx);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    tapBridge.onPointerUp(e as any);
    const d = dragRef.current;
    
    if (!d.active) {
      // Reset generico se non attivo
      d.direction = 'none';
      return;
    }

    d.active = false;

    // Fine Drag Verticale
    if (d.direction === 'vertical') {
        const totalDy = e.clientY - d.startY;
        const startPos = d.startTranslateY;
        const max = closedY || 0;
        const endPos = clampY(startPos + totalDy);

        if (Math.abs(totalDy) >= MIN_TOGGLE_DRAG) {
            if (totalDy < 0 && startPos >= max * 0.7) {
                d.direction = 'none';
                setAnim(true);
                setTranslateY(0);
                return;
            }
            if (totalDy > 0 && startPos <= max * 0.3) {
                d.direction = 'none';
                setAnim(true);
                setTranslateY(max);
                return;
            }
        }

        const now = performance.now();
        const dt = Math.max(1, now - d.lastT);
        const vy = (e.clientY - d.lastY) / dt;
        snapTo(vy, endPos);
    } 
    
    // Fine Drag Orizzontale
    else if (d.direction === 'horizontal') {
        const dx = e.clientX - d.startX;
        const threshold = 40; // Reduced swipe threshold (was 80)
        
        if (dx < -threshold && activeViewIndex < 2) {
            setActiveViewIndex(prev => prev + 1);
        } else if (dx > threshold && activeViewIndex > 0) {
            setActiveViewIndex(prev => prev - 1);
        }
        
        // Reset offset e attiva animazione di snap
        setIsSwipeAnimating(true);
        setSwipeOffset(0);
    }

    d.direction = 'none';
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    tapBridge.onPointerCancel?.(e as any);
    const d = dragRef.current;
    d.active = false;
    d.direction = 'none';
    
    // Reset vertical
    snapTo(0);
    
    // Reset horizontal
    setIsSwipeAnimating(true);
    setSwipeOffset(0);
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    tapBridge.onClickCapture(e as any);
  };

  const handleQuickSelect = useCallback(
    (v: DateFilter) => {
      props.onSelectQuickFilter(v);
    },
    [props.onSelectQuickFilter],
  );

  const handlePeriodDateChange = useCallback(
    (date: Date) => {
      props.onSetPeriodDate(date);
    },
    [props.onSetPeriodDate],
  );

  const handlePeriodTypeChange = useCallback(
    (type: PeriodType) => {
      props.onSelectPeriodType(type);
    },
    [props.onSelectPeriodType],
  );
  
  const handleCustomRangeChange = useCallback(
    (range: { start: string | null; end: string | null }) => {
      props.onCustomRangeChange(range);
    },
    [props.onCustomRangeChange]
  );

  // Calcolo posizione Y finale
  const yForStyle = laidOut
    ? clampY(translateY)
    : openHeight || (typeof window !== 'undefined' ? (window.innerHeight * OPEN_HEIGHT_VH) / 100 : 0);
    
  // Calcolo traslazione orizzontale lista
  const listTx = -activeViewIndex * (100 / 3); // base position %
  // Aggiungiamo swipeOffset in pixel usando calc
  const listTransform = `translateX(calc(${listTx}% + ${swipeOffset}px))`;

  const isQuickFilterActive = !props.isPeriodFilterActive && !props.isCustomRangeActive;

  const panel = (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClickCapture={handleClickCapture}
      data-no-page-swipe="true"
      className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-8px_20px_-5px_rgba(0,0,0,0.08)] z-[1000]"
      style={{
        height: `${OPEN_HEIGHT_VH}vh`,
        transform: `translate3d(0, ${yForStyle}px, 0)`,
        transition: anim ? 'transform 0.08s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
        touchAction: 'none', 
        backfaceVisibility: 'hidden',
        willChange: 'transform',
        opacity: laidOut ? 1 : 0,
        pointerEvents: laidOut ? 'auto' : 'none',
      }}
      onTransitionEnd={() => setAnim(false)}
    >
      {/* linguetta + chevron */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[88px] h-auto flex justify-center cursor-grab"
        style={{ transform: 'translateX(-50%) translateY(-19px)' }}
        aria-hidden="true"
      >
        <SmoothPullTab width="88" height="19" fill="white" />
        <ChevronDownIcon
          className={
            'absolute w-5 h-5 text-slate-400 transition-transform duration-300 ' +
            (isPanelOpen ? 'rotate-0' : 'rotate-180')
          }
          style={{ top: '2px' }}
        />
      </div>

      <div className="pt-1">
        <div
          className={'relative ' + (isPeriodMenuOpen ? 'overflow-visible' : 'overflow-hidden')}
        >
          <div
            className="w-[300%] flex"
            style={{
              transform: listTransform,
              transition: isSwipeAnimating ? 'transform 0.2s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
            }}
            onTransitionEnd={() => setIsSwipeAnimating(false)}
          >
            {/* QUICK */}
            <div className="w-1/3 px-4 py-1">
              <QuickFilterControl
                onSelect={handleQuickSelect}
                currentValue={props.currentQuickFilter}
                isActive={isQuickFilterActive}
              />
            </div>

            {/* PERIODO */}
            <div className="w-1/3 px-4 py-1">
              <PeriodNavigator
                periodType={props.periodType}
                periodDate={props.periodDate}
                onTypeChange={handlePeriodTypeChange}
                onDateChange={handlePeriodDateChange}
                isActive={props.isPeriodFilterActive}
                onActivate={props.onActivatePeriodFilter}
                isMenuOpen={isPeriodMenuOpen}
                onMenuToggle={setIsPeriodMenuOpen}
              />
            </div>

            {/* RANGE CUSTOM */}
            <div className="w-1/3 px-4 py-1">
              <CustomDateRangeInputs
                range={props.currentCustomRange}
                onChange={handleCustomRangeChange}
                isActive={props.isCustomRangeActive}
              />
            </div>
          </div>
        </div>

        {/* pallini di paging */}
        <div className="flex justify-center items-center pt-1 pb-2 gap-2">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              onClick={() => setActiveViewIndex(i)}
              type="button"
              className={
                'w-2.5 h-2.5 rounded-full transition-colors ' +
                (activeViewIndex === i
                  ? 'bg-indigo-600'
                  : 'bg-slate-300 hover:bg-slate-400')
              }
              aria-label={'Vai al filtro ' + (i + 1)}
            />
          ))}
        </div>

        {/* safe area bottom */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );

  return (
    <>
      {props.isActive && createPortal(panel, document.body)}
    </>
  );
};
