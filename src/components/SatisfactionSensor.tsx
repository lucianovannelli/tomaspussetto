import React, { useState, useEffect, useRef } from 'react';
import { submitFeedback } from '../lib/api';

interface SatisfactionSensorProps {
  memberId: string;
}

const EMOJIS = [
  { char: '😠', label: 'Muy insatisfecho', color: 'from-rose-500 to-red-600', textColor: 'text-red-500', shadow: 'shadow-red-500/20' },
  { char: '🙁', label: 'Insatisfecho', color: 'from-orange-400 to-amber-500', textColor: 'text-amber-500', shadow: 'shadow-amber-500/20' },
  { char: '😐', label: 'Neutral', color: 'from-yellow-400 to-yellow-500', textColor: 'text-yellow-500', shadow: 'shadow-yellow-500/20' },
  { char: '🙂', label: 'Satisfecho', color: 'from-sky-400 to-brand-500', textColor: 'text-sky-500', shadow: 'shadow-sky-500/20' },
  { char: '🥰', label: '¡Excelente!', color: 'from-emerald-400 to-emerald-600', textColor: 'text-emerald-500', shadow: 'shadow-emerald-500/20' },
];

export default function SatisfactionSensor({ memberId }: SatisfactionSensorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(5); // Default to excellent
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasRatedToday, setHasRatedToday] = useState(false);
  const [surveyStep, setSurveyStep] = useState<'select' | 'ksc' | 'success'>('select');

  // Reset step when modal opens
  useEffect(() => {
    if (isOpen) {
      setSurveyStep('select');
    }
  }, [isOpen]);

  // Floating coordinates and dragging state
  const [x, setX] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [widgetWidth, setWidgetWidth] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLButtonElement>(null);
  const dragStartRef = useRef<{ startX: number; clientX: number; timestamp: number } | null>(null);
  const hasDraggedRef = useRef(false);

  // Check if already submitted today
  useEffect(() => {
    const today = new Date().toDateString();
    const lastSubmitted = localStorage.getItem(`tp_feedback_date_${memberId}`) || localStorage.getItem(`ksc_feedback_date_${memberId}`);
    if (lastSubmitted === today) {
      setHasRatedToday(true);
    }
    
    // Check saved dock side
    const savedSide = localStorage.getItem('tp_feedback_dock_side') || localStorage.getItem('ksc_feedback_dock_side');
    if (savedSide) {
      // Position will be calculated when container size is measured
    }
  }, [memberId]);

  // Handle container and widget sizing
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateSizes = () => {
      if (!containerRef.current) return;
      const cWidth = containerRef.current.getBoundingClientRect().width;
      setContainerWidth(cWidth);
      
      const wWidth = widgetRef.current ? widgetRef.current.getBoundingClientRect().width : 120;
      setWidgetWidth(wWidth);
      
      // Initial alignment: defaults to right unless left was saved
      if (x === null && cWidth > 0 && wWidth > 0) {
        const savedSide = localStorage.getItem('ksc_feedback_dock_side');
        if (savedSide === 'left') {
          setX(16);
        } else {
          setX(cWidth - wWidth - 16);
        }
      }
    };

    updateSizes();
    const observer = new ResizeObserver(updateSizes);
    observer.observe(containerRef.current);
    if (widgetRef.current) {
      observer.observe(widgetRef.current);
    }
    
    return () => observer.disconnect();
  }, [x]);

  // Pointer dragging logic
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only left click
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      startX: x ?? 0,
      clientX: e.clientX,
      timestamp: Date.now()
    };
    setIsDragging(true);
    hasDraggedRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    
    const deltaX = e.clientX - dragStartRef.current.clientX;
    let newX = dragStartRef.current.startX + deltaX;
    
    // Limits: 16px to containerWidth - widgetWidth - 16px
    const minX = 16;
    const maxX = Math.max(16, containerWidth - widgetWidth - 16);
    
    if (newX < minX) newX = minX;
    if (newX > maxX) newX = maxX;
    
    setX(newX);
    
    if (Math.abs(deltaX) > 6) {
      hasDraggedRef.current = true;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    dragStartRef.current = null;
    setIsDragging(false);
    
    if (!hasDraggedRef.current) {
      // It's a tap/click! Open the survey modal
      setIsOpen(true);
    } else {
      // Snap to closest edge
      const midPoint = containerWidth / 2;
      const widgetMid = (x ?? 0) + widgetWidth / 2;
      const minX = 16;
      const maxX = Math.max(16, containerWidth - widgetWidth - 16);
      
      if (widgetMid < midPoint) {
        setX(minX);
        localStorage.setItem('ksc_feedback_dock_side', 'left');
      } else {
        setX(maxX);
        localStorage.setItem('ksc_feedback_dock_side', 'right');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    const success = await submitFeedback(memberId, rating, comment);
    setSubmitting(false);
    
    if (success) {
      setSurveyStep('success');
      const today = new Date().toDateString();
      localStorage.setItem(`ksc_feedback_date_${memberId}`, today);
      setHasRatedToday(true);
      
      // Auto close after 2.5s unless rating >= 4 (excellent/satisfecho), then give 8s to see the Google link
      setTimeout(() => {
        setIsOpen(false);
        // Reset form states for next time
        setSurveyStep('select');
        setComment('');
      }, rating >= 4 ? 8000 : 2500);
    } else {
      alert('Hubo un error al enviar tu calificación. Por favor intenta de nuevo.');
    }
  };

  // Emojis for selected index
  const activeEmoji = EMOJIS[rating - 1];

  return (
    <>
      {/* Draggable Floating Button Wrapper */}
      <div 
        ref={containerRef}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pointer-events-none z-40 select-none"
      >
        <button
          ref={widgetRef}
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            transform: x !== null ? `translate3d(${x}px, 0, 0)` : 'translate3d(0, 0, 0)',
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
            opacity: x !== null ? 1 : 0
          }}
          className={`pointer-events-auto flex items-center gap-2 px-3.5 py-2.5 rounded-full border shadow-lg cursor-grab active:cursor-grabbing backdrop-blur-md transition-all ${
            hasRatedToday 
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800 shadow-emerald-500/10'
              : 'bg-white/95 border-brand-100 text-slate-700 shadow-brand-500/10 hover:border-brand-200 hover:scale-105 active:scale-95'
          }`}
        >
          <span className="text-lg animate-bounce">
            {hasRatedToday ? '✨' : '💬'}
          </span>
          <span className="text-xs font-extrabold uppercase tracking-wider pr-1">
            {hasRatedToday ? '¡Gracias!' : 'Calificar experiencia'}
          </span>
          {/* Subtle grab handle indicator */}
          <div className="flex flex-col gap-0.5 opacity-40 pl-0.5 border-l border-slate-200">
            <div className="w-1.5 h-0.5 bg-current rounded-full"></div>
            <div className="w-1.5 h-0.5 bg-current rounded-full"></div>
            <div className="w-1.5 h-0.5 bg-current rounded-full"></div>
          </div>
        </button>
      </div>

      {/* Survey Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop blur */}
          <div 
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => {
              if (!submitting && surveyStep !== 'success') setIsOpen(false);
            }}
          />
          
          {/* Modal Card */}
          <div className="relative w-full max-w-sm bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 overflow-hidden animate-slide-up flex flex-col gap-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
              <div className="flex items-center gap-2">
                {surveyStep === 'ksc' && (
                  <button
                    type="button"
                    onClick={() => setSurveyStep('select')}
                    disabled={submitting}
                    className="w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 flex items-center justify-center transition active:scale-90"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </button>
                )}
                <span className="text-xs font-black uppercase tracking-widest text-[#26160d] bg-[#faf7f2] border border-[#e6dfd5] px-2.5 py-1 rounded-md">
                  Tomás Feedback
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={submitting}
                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition disabled:opacity-30"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Content States */}
            {surveyStep === 'select' && (
              <div className="flex flex-col gap-4 py-2 animate-fade-in">
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-black text-slate-900 leading-tight">
                    ¿Cómo viene tu proceso de entrenamiento?
                  </h3>
                  <p className="text-[10px] text-[#5e4e43] font-bold uppercase tracking-widest mt-0.5">
                    Método ENDS
                  </p>
                </div>

                <div className="flex flex-col gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setSurveyStep('ksc')}
                    className="flex items-center gap-4 p-4 rounded-2xl border border-[#e6dfd5] bg-[#faf7f2] hover:bg-[#f5f0e8] transition-all text-left group active:scale-[0.98]"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#26160d] text-[#f5f0e8] flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-sm shrink-0">
                      💬
                    </div>
                    <div className="flex-1 space-y-0.5 min-w-0">
                      <p className="text-sm font-extrabold text-slate-800">
                        Comentario para Tomás
                      </p>
                      <p className="text-xs text-slate-500 font-bold leading-normal">
                        Dejanos tu feedback para ajustar tus rutinas y objetivos.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {surveyStep === 'ksc' && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5 animate-fade-in">
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-black text-slate-900 leading-tight">
                    ¿Qué tan satisfecho estás con tu entrenamiento con Tomás?
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">
                    Deslizá de izquierda a derecha para calificar
                  </p>
                </div>

                {/* Interactive Sensor Rating Area */}
                <div className="flex flex-col items-center justify-center py-6 bg-slate-50 rounded-2xl border border-slate-100/60 relative overflow-hidden">
                  
                  {/* Dynamic glow in background */}
                  <div className={`absolute inset-0 bg-gradient-to-b ${activeEmoji.color} opacity-[0.04] transition-all duration-500`} />

                  {/* Displaying large active emoji with animation */}
                  <div className="relative flex flex-col items-center justify-center gap-2 z-10">
                    <span 
                      key={rating} // Keys force re-render for trigger CSS pop animation
                      className={`text-7xl select-none transform transition-transform duration-300 animate-pulse`}
                      style={{ animationDuration: '2s' }}
                    >
                      {activeEmoji.char}
                    </span>
                    <span className={`text-base font-black tracking-wide ${activeEmoji.textColor} uppercase transition-all duration-300`}>
                      {activeEmoji.label}
                    </span>
                  </div>

                  {/* Slider Indicator Tracker */}
                  <div className="w-full px-6 mt-6 z-10">
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 outline-none accent-[#26160d] focus:outline-none"
                      style={{
                        background: `linear-gradient(to right, #ef4444 0%, #f59e0b 25%, #eab308 50%, #06b6d4 75%, #10b981 100%)`
                      }}
                    />
                    
                    {/* Tick markers */}
                    <div className="flex justify-between px-1.5 mt-2 text-[10px] font-black text-slate-400">
                      <span>Malo</span>
                      <span>Regular</span>
                      <span>Excelente</span>
                    </div>
                  </div>
                </div>

                {/* Optional Feedback Comment */}
                <div className="space-y-1">
                  <label htmlFor="feedback-comment" className="text-xs font-bold text-slate-600">
                    ¿Qué sugerencia o comentario querés hacerle a Tomás? (Opcional)
                  </label>
                  <textarea
                    id="feedback-comment"
                    placeholder="Contanos tu experiencia..."
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[#e6dfd5] bg-[#faf7f2] px-3.5 py-2.5 outline-none focus:border-[#26160d] focus:bg-white transition-all resize-none"
                  />
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 rounded-xl bg-[#26160d] text-[#f5f0e8] font-extrabold uppercase tracking-wider text-sm transition hover:bg-[#3d2b20] active:scale-98 shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Enviando...
                    </>
                  ) : (
                    'Enviar mi opinión'
                  )}
                </button>
              </form>
            )}

            {surveyStep === 'success' && (
              /* Success / Thank You State */
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-4 animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/10 border border-emerald-100">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div className="space-y-1.5 pb-2">
                  <h3 className="text-xl font-black text-slate-900">¡Opinión enviada!</h3>
                  <p className="text-sm font-bold text-slate-500 max-w-[240px] mx-auto">
                    Gracias por ayudarnos a ajustar tu entrenamiento al máximo.
                  </p>
                </div>
                {rating >= 4 && (
                  <div className="pt-2 border-t border-slate-50 w-full animate-fade-in space-y-2">
                    <p className="text-xs font-bold text-slate-400">
                      ¿Querés dejarnos tu reseña también en Google?
                    </p>
                    <a
                      href="https://search.google.com/local/writereview?placeid=ChIJ24SC_Wmrt5UR1_Ow_xRcFaA"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="touch-btn bg-slate-900 hover:bg-slate-800 text-white text-xs py-2 px-4 rounded-xl inline-flex items-center gap-1.5 active:scale-95 transition"
                      onClick={() => setIsOpen(false)}
                    >
                      Escribir reseña 🌟
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Styled Slider Thumb Custom CSS injection */}
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #7c3aed;
          border: 3px solid #ffffff;
          box-shadow: 0 4px 10px rgba(124, 58, 237, 0.35);
          cursor: pointer;
          transition: transform 0.1s, background-color 0.2s;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        input[type="range"]::-webkit-slider-thumb:active {
          transform: scale(0.95);
          background: #6d28d9;
        }
        input[type="range"]::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #7c3aed;
          border: 3px solid #ffffff;
          box-shadow: 0 4px 10px rgba(124, 58, 237, 0.35);
          cursor: pointer;
          transition: transform 0.1s, background-color 0.2s;
        }
        input[type="range"]::-moz-range-thumb:hover {
          transform: scale(1.15);
        }
        input[type="range"]::-moz-range-thumb:active {
          transform: scale(0.95);
          background: #6d28d9;
        }
      `}</style>
    </>
  );
}
