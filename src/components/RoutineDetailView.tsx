import { useEffect, useMemo, useState, useRef } from 'react';
import { fetchRoutine, saveExerciseWeight, completeRoutine, isDemoMode, saveExerciseLikeStatus, isBasicMode, setBasicMode, getYouTubeEmbedUrl } from '../lib/api';
import type { RoutineDetail, RoutineBlock } from '../lib/types';
import { navigate } from 'astro:transitions/client';

interface Props {
  routineId: string;
}

export default function RoutineDetailView({ routineId }: Props) {
  const [routine, setRoutine] = useState<RoutineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeVideo, setActiveVideo] = useState<{ url: string; title: string } | null>(null);
  const [weights, setWeights] = useState<Record<string, string[]>>({});
  const [roundInput, setRoundInput] = useState('');
  const [activeWeightEditor, setActiveWeightEditor] = useState<{
    exerciseId: string;
    exerciseName: string;
    setIndex: number;
    setReps: string;
    roundsPerSet: number;
  } | null>(null);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [lastSaved, setLastSaved] = useState<Record<string, number>>({});
  const [showRoundSavedFeedback, setShowRoundSavedFeedback] = useState(false);
  const [activeTabId, setActiveTabId] = useState('');
  const [selectedRoundIndex, setSelectedRoundIndex] = useState<number | null>(null);
  
  // Completion states
  const [isCompletedState, setIsCompletedState] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCompleteConfirmation, setShowCompleteConfirmation] = useState(false);
  const [showCompleteSuccess, setShowCompleteSuccess] = useState(false);

  // Day Completion states
  const [completedDays, setCompletedDays] = useState<string[]>([]);
  const [showDayCompleteSuccess, setShowDayCompleteSuccess] = useState(false);
  const [lastCompletedDayLabel, setLastCompletedDayLabel] = useState('');
  const [completedSessions, setCompletedSessions] = useState<Record<string, number>>({});

  const inputRef = useRef<HTMLInputElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  
  const timeoutsRef = useRef<Record<string, any>>({});

  const [basicMode, setBasicModeState] = useState(() => isBasicMode());

  const handleCompleteRoutine = async () => {
    setIsCompleting(true);
    const success = await completeRoutine(routineId);
    setIsCompleting(false);
    if (success) {
      setIsCompletedState(true);
      setShowCompleteConfirmation(false);
      setShowCompleteSuccess(true);
      // En modo básico: quedarse en pantalla. En modo normal: redirigir.
      if (!basicMode) {
        setTimeout(() => {
          navigate('/dashboard', { history: 'replace' });
        }, 3000);
      }
    } else {
      alert('Hubo un error al terminar la rutina. Por favor intentá de nuevo.');
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`ksc_completed_days_${routineId}`);
      if (saved) {
        setCompletedDays(JSON.parse(saved));
      } else {
        setCompletedDays([]);
      }
    } catch (e) {
      console.error('Error loading completed days', e);
    }
  }, [routineId]);

  useEffect(() => {
    if (activeWeightEditor && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [selectedRoundIndex, activeWeightEditor]);

  useEffect(() => {
    if (activeWeightEditor) {
      document.body.style.overflow = 'hidden';
      if (modalContentRef.current) {
        modalContentRef.current.scrollTop = 0;
      }
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [activeWeightEditor]);

  useEffect(() => {
    fetchRoutine(routineId)
      .then((data) => {
        setRoutine(data);
        setIsCompletedState(data?.completed || false);
        const initialWeights: Record<string, string[]> = {};
        (data?.blocks || []).forEach((block) => {
          (block?.exercises || []).forEach((exercise) => {
            const setsCount = getExerciseRoundsCount(block.rounds, exercise.sets || 1);
            const exerciseSets = exercise.sets && exercise.sets > 0 ? exercise.sets : 1;
            const existingWeights = (exercise.weight || '').split(',').map((w) => w.trim());
            const finalSetsCount = Math.max(setsCount, exerciseSets, existingWeights.length);
            initialWeights[exercise.id] = Array.from({ length: finalSetsCount }, (_, i) => existingWeights[i] || '');
          });
        });
        setWeights(initialWeights);
      })
      .catch(() => {
        setError('No se pudo cargar la rutina.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [routineId]);

  const dayTabs = useMemo(() => {
    if (!routine) return [];

    const tabs: Array<{ id: string; label: string; blocks: RoutineBlock[] }> = [];
    let currentDayTab: { id: string; label: string; blocks: RoutineBlock[] } | null = null;
    let iniTab: { id: string; label: string; blocks: RoutineBlock[] } | null = null;

    (routine.blocks || []).forEach((block) => {
      const name = block.name.trim();
      const isWarmup = block.type === 'warmup';
      const dayMatch = name.match(/^(DÍ?A\s*\d+)/i);

      if (isWarmup) {
        if (!iniTab) {
          iniTab = { id: 'ini', label: 'INI', blocks: [] };
          tabs.push(iniTab);
        }
        iniTab.blocks.push(block);
      } else if (dayMatch) {
        const label = dayMatch[1].toUpperCase();
        const id = label.replace(/\s+/g, '-');
        const existingTab = tabs.find((t) => t.id === id);
        if (existingTab) {
          existingTab.blocks.push(block);
          currentDayTab = existingTab;
        } else {
          currentDayTab = { id, label, blocks: [block] };
          tabs.push(currentDayTab);
        }
      } else if (currentDayTab) {
        currentDayTab.blocks.push(block);
      } else {
        if (!iniTab) {
          iniTab = { id: 'ini', label: 'INI', blocks: [] };
          tabs.push(iniTab);
        }
        iniTab.blocks.push(block);
      }
    });

    return tabs;
  }, [routine]);

  const isActualDayTab = (tab: { id: string; label: string }) => {
    return tab.label.toUpperCase().startsWith('DÍ') || tab.label.toUpperCase().startsWith('DIA');
  };

  const handleCompleteDay = (tabId: string) => {
    const tabObj = dayTabs.find(t => t.id === tabId);
    const label = tabObj ? tabObj.label : 'Día';
    
    if (!completedDays.includes(tabId)) {
      const newCompleted = [...completedDays, tabId];

      // Increment completed sessions count for this day/tab
      const currentCount = completedSessions[tabId] || 0;
      const newCount = currentCount + 1;
      setCompletedSessions(prev => ({ ...prev, [tabId]: newCount }));
      localStorage.setItem(`ksc_completed_sessions_${routineId}_${tabId}`, String(newCount));
      
      const actualDays = dayTabs.filter(isActualDayTab);
      const isAllDaysCompleted = actualDays.every(tab => newCompleted.includes(tab.id));

      if (isAllDaysCompleted) {
        setCompletedDays([]);
        localStorage.removeItem(`ksc_completed_days_${routineId}`);
        
        if (basicMode) {
          void handleCompleteRoutine();
        } else {
          setLastCompletedDayLabel('semana');
          setShowDayCompleteSuccess(true);
          
          setTimeout(() => {
            setShowDayCompleteSuccess(false);
            if (actualDays.length > 0) {
              setActiveTabId(actualDays[0].id);
            }
          }, 2500);
        }
      } else {
        setCompletedDays(newCompleted);
        localStorage.setItem(`ksc_completed_days_${routineId}`, JSON.stringify(newCompleted));
        
        setLastCompletedDayLabel(label);
        setShowDayCompleteSuccess(true);
        
        const currentIndex = actualDays.findIndex(tab => tab.id === tabId);
        const nextTab = actualDays[currentIndex + 1];
        
        setTimeout(() => {
          setShowDayCompleteSuccess(false);
          if (nextTab) {
            setActiveTabId(nextTab.id);
          }
        }, 2000);
      }
    }
  };

  const handleToggleLikeStatus = async (exerciseId: string, targetStatus: 'like' | 'dislike') => {
    if (!routine) return;
    
    let currentStatus: 'like' | 'dislike' | null = null;
    for (const block of routine.blocks) {
      const found = block.exercises.find(ex => ex.id === exerciseId);
      if (found) {
        currentStatus = found.likeStatus || null;
        break;
      }
    }
    
    const newStatus = currentStatus === targetStatus ? null : targetStatus;

    // Optimistic UI update
    setRoutine(prev => {
      if (!prev) return null;
      return {
        ...prev,
        blocks: prev.blocks.map(block => ({
          ...block,
          exercises: block.exercises.map(ex => {
            if (ex.id === exerciseId) {
              return { ...ex, likeStatus: newStatus };
            }
            return ex;
          })
        }))
      };
    });

    try {
      await saveExerciseLikeStatus(routineId, exerciseId, newStatus);
    } catch (err) {
      console.error('Error saving exercise feedback', err);
    }
  };

  // Load completed sessions counts when routine or dayTabs change
  useEffect(() => {
    if (!routine) return;
    const initialCounts: Record<string, number> = {};
    dayTabs.forEach((tab) => {
      const count = Number(localStorage.getItem(`ksc_completed_sessions_${routineId}_${tab.id}`) || '0');
      initialCounts[tab.id] = count;
    });
    setCompletedSessions(initialCounts);
  }, [routine, routineId, dayTabs]);

  const suggestedDayTab = useMemo(() => {
    const actualDays = dayTabs.filter(isActualDayTab);
    return actualDays.find((tab) => !completedDays.includes(tab.id)) || null;
  }, [dayTabs, completedDays]);

  const basicModeActiveDayTab = useMemo(() => {
    return suggestedDayTab ?? dayTabs.filter(isActualDayTab)[0] ?? null;
  }, [suggestedDayTab, dayTabs]);

  // En modo básico: combinamos los bloques de INI + día sugerido en una única vista
  const basicModeBlocks = useMemo(() => {
    if (!basicMode) return [];
    const iniTab = dayTabs.find(t => t.id === 'ini');
    const dayTab = basicModeActiveDayTab;
    const iniBlocks = iniTab ? iniTab.blocks : [];
    const dayBlocks = dayTab ? dayTab.blocks : [];
    return [...iniBlocks, ...dayBlocks];
  }, [basicMode, dayTabs, basicModeActiveDayTab]);

  const basicModeDayLabel = useMemo(() => {
    return basicModeActiveDayTab ? basicModeActiveDayTab.label : '';
  }, [basicModeActiveDayTab]);

  useEffect(() => {
    if (!dayTabs.length) {
      setActiveTabId('');
      return;
    }

    setActiveTabId((currentTabId) => {
      if (currentTabId && dayTabs.some((tab) => tab.id === currentTabId)) {
        return currentTabId;
      }
      return dayTabs[0].id;
    });
  }, [dayTabs]);

  const activeTab = useMemo(() => {
    return dayTabs.find((tab) => tab.id === activeTabId) ?? dayTabs[0];
  }, [dayTabs, activeTabId]);

  const handleLogout = () => {
    localStorage.removeItem('ksc_member_id');
    localStorage.removeItem('ksc_demo_mode');
    navigate('/login', { history: 'replace' });
  };

  const autoSaveWeight = async (exerciseId: string, weightArray: string[]) => {
    const weightString = weightArray.join(',');
    setSavingIds(prev => ({ ...prev, [exerciseId]: true }));
    
    try {
      await saveExerciseWeight(routineId, exerciseId, weightString);
      setLastSaved(prev => ({ ...prev, [exerciseId]: Date.now() }));
    } catch (e) {
      console.error('Failed to autosave', e);
    } finally {
      setSavingIds(prev => ({ ...prev, [exerciseId]: false }));
    }
  };

  const parseWeightInput = (value: string) => {
    const normalized = value.replace(',', '.').trim();
    if (!normalized) return '';
    if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
    return normalized;
  };

  const getExerciseRoundsCount = (blockRounds: string | undefined, fallbackSets: number) => {
    const roundsMatch = (blockRounds || '').match(/\d+/);
    const rounds = roundsMatch ? Number(roundsMatch[0]) : 0;
    if (Number.isFinite(rounds) && rounds > 0) return rounds;
    return fallbackSets > 0 ? fallbackSets : 1;
  };

  const getRoundsPerSetCount = (blockRounds: string | undefined) => {
    const roundsMatch = (blockRounds || '').match(/\d+/);
    const rounds = roundsMatch ? Number(roundsMatch[0]) : 0;
    if (Number.isFinite(rounds) && rounds > 0) return rounds;
    return 1;
  };

  const getSetRounds = (setValue: string) => {
    if (!setValue) return [];
    return setValue
      .split('/')
      .map((value) => value.trim());
  };

  const saveSetRoundWeight = (exerciseId: string, setIndex: number, roundsPerSet: number, customValue?: string) => {
    const rawValue = customValue !== undefined ? customValue : roundInput;
    const parsedWeight = parseWeightInput(rawValue);
    if (parsedWeight === null) return;

    const currentWeights = weights[exerciseId] || [];
    const newWeightsForExercise = [...currentWeights];
    const currentSetRounds = getSetRounds(newWeightsForExercise[setIndex] || '');
    
    // Create copy of rounds up to roundsPerSet
    const updatedSetRounds = Array.from({ length: roundsPerSet }, (_, idx) => currentSetRounds[idx] || '');
    const targetRoundIdx = selectedRoundIndex !== null ? selectedRoundIndex : (currentSetRounds.length < roundsPerSet ? currentSetRounds.length : 0);
    
    updatedSetRounds[targetRoundIdx] = parsedWeight;
    
    // Filter out trailing empty strings
    let lastNonEmptyIndex = -1;
    for (let i = updatedSetRounds.length - 1; i >= 0; i--) {
      if (updatedSetRounds[i]) {
        lastNonEmptyIndex = i;
        break;
      }
    }
    const finalSetRounds = updatedSetRounds.slice(0, lastNonEmptyIndex + 1).map(v => v || '');
    newWeightsForExercise[setIndex] = finalSetRounds.join('/');

    setWeights((prev) => ({ ...prev, [exerciseId]: newWeightsForExercise }));
    
    setShowRoundSavedFeedback(true);
    setTimeout(() => setShowRoundSavedFeedback(false), 1200);

    const nextRoundIndex = targetRoundIdx + 1;
    if (customValue !== undefined) {
      setRoundInput('');
    } else if (nextRoundIndex < roundsPerSet) {
      setSelectedRoundIndex(nextRoundIndex);
      setRoundInput(updatedSetRounds[nextRoundIndex] || '');
    } else {
      setRoundInput(parsedWeight);
      // Auto close the modal after a short delay so they can see the save feedback
      setTimeout(() => {
        setActiveWeightEditor(null);
      }, 500);
    }

    if (timeoutsRef.current[exerciseId]) {
      clearTimeout(timeoutsRef.current[exerciseId]);
    }

    timeoutsRef.current[exerciseId] = setTimeout(() => {
      void autoSaveWeight(exerciseId, newWeightsForExercise);
    }, 250);
  };

  const resetEntireSet = async (exerciseId: string, setIndex: number) => {
    if (!confirm('¿Estás seguro de que querés borrar todos los pesos de esta sesión?')) return;
    
    const currentWeights = weights[exerciseId] || [];
    const newWeightsForExercise = [...currentWeights];
    newWeightsForExercise[setIndex] = '';

    setWeights((prev) => ({ ...prev, [exerciseId]: newWeightsForExercise }));
    
    setSelectedRoundIndex(0);
    setRoundInput('');
    
    if (timeoutsRef.current[exerciseId]) {
      clearTimeout(timeoutsRef.current[exerciseId]);
    }
    
    void autoSaveWeight(exerciseId, newWeightsForExercise);
  };

  const getSetDisplayValue = (setValue: string) => {
    const rounds = getSetRounds(setValue);
    if (rounds.length === 0) return '—';
    return rounds.map(r => r || '—').join(' / ');
  };

  if (loading) {
    return <p className="surface-card text-base font-medium text-slate-700">Cargando rutina...</p>;
  }

  if (error && !routine) {
    return (
      <div className="space-y-3">
        <p className="surface-card text-base font-medium text-red-700">{error}</p>
        <a className="touch-btn" href="/dashboard">
          Volver
        </a>
      </div>
    );
  }

  if (!routine) {
    return (
      <div className="space-y-3">
        <p className="surface-card text-base font-medium text-slate-700">No encontramos esta rutina.</p>
        <a className="touch-btn" href="/dashboard">
          Volver
        </a>
      </div>
    );
  }

  return (
    <section className="space-y-4">

      {/* ── MODO BÁSICO: header minimal ── */}
      {basicMode ? (
        <header className="pt-2 pb-1 px-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-600">
              {basicModeDayLabel || 'Tu entrenamiento'}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 px-2.5 py-1.5 rounded-lg transition border border-brand-100/50"
                onClick={() => {
                  setBasicMode(false);
                  setBasicModeState(false);
                }}
              >
                Modo completo
              </button>
              <button type="button" className="text-xs font-bold text-slate-400 underline" onClick={handleLogout}>
                Salir
              </button>
            </div>
          </div>
        </header>
      ) : (
        /* ── MODO NORMAL: header completo ── */
        <header className="surface-card space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <span className="brand-badge" style={{ viewTransitionName: 'brand-logo' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#f5f0e8', flexShrink: 0 }}>
                  <path d="M13 2L4.09 12.97H11L10 22L20.09 11.03H13L13 2Z" />
                </svg>
                <span className="badge-text">Tomás Pussetto</span>
              </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex flex-wrap items-center gap-2">
              {routine.name}
              {isDemoMode() && (
                <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand-700">Demo</span>
              )}
              {isCompletedState && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">Terminada ✓</span>
              )}
            </h1>
            <p className="text-base font-medium text-slate-700">Fecha: {routine.date}</p>
          </div>
          <button type="button" className="ghost-btn shrink-0" onClick={handleLogout}>
            Cerrar sesion
          </button>
        </div>
        <div className="flex gap-3">
          <a href="/dashboard" className="secondary-btn">
            Volver
          </a>
          {!isCompletedState && (
            <button
              type="button"
              className="inline-flex h-12 flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 text-base font-extrabold text-white transition hover:bg-emerald-700 active:scale-98 shadow-md shadow-emerald-500/10"
              onClick={() => setShowCompleteConfirmation(true)}
            >
              Terminar rutina
            </button>
          )}
        </div>
      </header>
      )}{/* cierre del condicional modo básico vs normal */}

      {isCompletedState && (
        <div className="surface-card bg-emerald-50 border-emerald-200 text-emerald-800 flex items-center gap-3 p-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900">¡Rutina Completada!</h3>
            <p className="text-sm font-semibold text-emerald-700">Tu entrenador ya puede ver que finalizaste esta rutina.</p>
          </div>
        </div>
      )}

      {suggestedDayTab && activeTabId !== suggestedDayTab.id && !isCompletedState && (
        <div className="surface-card bg-brand-50/80 border-brand-200 text-brand-800 flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🎯</span>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Hoy te toca entrenar</h3>
              <p className="text-xs font-semibold text-brand-700">{suggestedDayTab.label}</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-xl bg-brand-600 px-4 text-xs font-extrabold text-white transition hover:bg-brand-700 active:scale-95 shadow-md shadow-brand-500/10 cursor-pointer"
            onClick={() => setActiveTabId(suggestedDayTab.id)}
          >
            Ir a {suggestedDayTab.label}
          </button>
        </div>
      )}

      {/* En modo básico no hay sugerencia de día, se muestra todo combinado */}
      {!basicMode && activeTab ? (
        <section className="surface-card space-y-3">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-700">Vista activa</p>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold text-slate-900">{activeTab.label}</h2>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700">
              {activeTab.blocks.length} bloques
            </span>
          </div>
        </section>
      ) : null}

      <div className={basicMode ? 'space-y-4 pb-36' : 'space-y-4 pb-28'}>
        {(basicMode ? basicModeBlocks : (activeTab?.blocks ?? [])).map((block) => (
          <section key={block.id} className="surface-card space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="space-y-1">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-700">
                  {block.type === 'warmup' ? 'Entrada en calor' : 'Bloque de entrenamiento'}
                </p>
                <h2 className="text-xl font-extrabold text-slate-900">{block.name}</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                {block.exercises.length} ejercicios
              </span>
            </div>

            <ul className="space-y-3">
              {(block.exercises || []).map((exercise) => {
                const exerciseSets = exercise.sets && exercise.sets > 0 ? exercise.sets : 1;
                const roundsPerSet = getRoundsPerSetCount(block.rounds);
                const repsList = (exercise.reps || '').split(',').map((r) => r.trim()).filter(r => r !== '');
                const hasReps = repsList.length > 0;
                const exerciseWeights = weights[exercise.id] || [];
                const isSaving = savingIds[exercise.id];
                const wasSaved = lastSaved[exercise.id] && Date.now() - lastSaved[exercise.id] < 3000;

                return (
                  <li key={exercise.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl font-extrabold text-slate-900">{exercise.name}</h3>
                          {exercise.videoUrl && (
                            <button
                              type="button"
                              onClick={() => setActiveVideo({ url: exercise.videoUrl!, title: exercise.name })}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-100 hover:bg-brand-200 border border-brand-300 text-brand-800 text-xs font-extrabold transition active:scale-95 cursor-pointer shadow-sm"
                            >
                              <svg className="w-3.5 h-3.5 text-brand-700 fill-current" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                              <span>Ver Técnica</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-slate-100/60 p-0.5 rounded-xl border border-slate-200/50">
                          <button
                            type="button"
                            onClick={() => handleToggleLikeStatus(exercise.id, 'like')}
                            className={`p-2 rounded-lg transition-all active:scale-95 ${
                              exercise.likeStatus === 'like'
                                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'
                            }`}
                            title="Me gusta"
                          >
                            <svg className="w-4 h-4" fill={exercise.likeStatus === 'like' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                              <path d="M7 10v12" />
                              <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleLikeStatus(exercise.id, 'dislike')}
                            className={`p-2 rounded-lg transition-all active:scale-95 ${
                              exercise.likeStatus === 'dislike'
                                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'
                            }`}
                            title="No me gusta"
                          >
                            <svg className="w-4 h-4" fill={exercise.likeStatus === 'dislike' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                              <path d="M17 14V2" />
                              <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
                            </svg>
                          </button>
                        </div>

                        {hasReps && (
                          <div className="flex items-center gap-2">
                             {isSaving ? (
                               <span className="text-[10px] font-bold uppercase tracking-wider text-brand-500 animate-pulse">Guardando...</span>
                             ) : wasSaved ? (
                               <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">¡Guardado!</span>
                             ) : null}
                          </div>
                        )}
                      </div>
                    </div>

                    {hasReps && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Pesos por vuelta</p>
                        <div className="space-y-2 rounded-xl bg-white p-3 border border-slate-100">
                          <div className="flex flex-col gap-2">
                            {Array.from({ length: exerciseSets }).map((_, setIndex) => {
                              const setReps = repsList[setIndex] || repsList[0] || '?';
                              const value = getSetDisplayValue(exerciseWeights[setIndex] || '');
                              
                              const isNewFeatureActive = routine && routine.date >= '2026-06-05';
                              const completedCount = activeTab ? (completedSessions[activeTab.id] || 0) : 0;

                              const isCompleted = isNewFeatureActive && setIndex < completedCount;
                              const isActive = isNewFeatureActive && setIndex === completedCount;

                              let buttonClass = "w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition flex justify-between items-center active:scale-[0.99]";
                              if (isCompleted) {
                                buttonClass += " border-emerald-100 bg-emerald-50/20 text-slate-500 opacity-80 hover:bg-emerald-50/30";
                              } else if (isActive) {
                                buttonClass += " border-brand-300 bg-brand-50/40 text-slate-800 hover:border-brand-400 hover:bg-brand-50/60 ring-2 ring-brand-500/10";
                              } else {
                                buttonClass += " border-slate-150 bg-slate-50/70 text-slate-700 hover:border-brand-400 hover:bg-brand-50/50";
                              }

                              return (
                                <button
                                  type="button"
                                  key={setIndex}
                                  onClick={() => {
                                    const currentWeights = weights[exercise.id] || [];
                                    const selectedSetValue = currentWeights[setIndex] || '';
                                    const selectedSetRounds = getSetRounds(selectedSetValue);
                                    const firstEmptyIndex = selectedSetRounds.length < roundsPerSet 
                                      ? selectedSetRounds.length 
                                      : 0;
                                    
                                    setSelectedRoundIndex(firstEmptyIndex);
                                    setRoundInput(selectedSetRounds[firstEmptyIndex] || '');
                                    
                                    setActiveWeightEditor({
                                      exerciseId: exercise.id,
                                      exerciseName: exercise.name,
                                      setIndex,
                                      setReps,
                                      roundsPerSet
                                    });
                                  }}
                                  className={buttonClass}
                                >
                                  <span className="font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                                    <span>Sesión {setIndex + 1}</span>
                                    <span className="text-xs text-slate-400 font-normal">({setReps} reps)</span>
                                    {isCompleted && (
                                      <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold text-[10px] bg-emerald-50 border border-emerald-100/50 px-1.5 py-0.5 rounded">
                                        Completada ✓
                                      </span>
                                    )}
                                    {isActive && (
                                      <span className="inline-flex items-center gap-0.5 text-brand-700 font-extrabold text-[9px] uppercase tracking-wider bg-brand-100 border border-brand-200/50 px-1.5 py-0.5 rounded animate-pulse">
                                        Siguiente 🎯
                                      </span>
                                    )}
                                  </span>
                                   <span className="font-black text-brand-600 bg-white border border-slate-100 px-3 py-1 rounded-lg text-xs tracking-wider whitespace-nowrap shrink-0">
                                     {value}
                                   </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {(() => {
          if (isCompletedState) {
            return (
              <section className="surface-card bg-gradient-to-br from-slate-50 to-white border-slate-200 p-6 space-y-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900">Rutina Terminada</h3>
                  <p className="text-sm font-semibold text-slate-600">
                    ¡Excelente trabajo! Le avisamos a tu entrenador.
                  </p>
                </div>
                {!basicMode && (
                  <a href="/dashboard" className="secondary-btn w-full flex items-center justify-center">
                    Volver al Dashboard
                  </a>
                )}
              </section>
            );
          }

          const isActualDay = activeTab && (activeTab.label.toUpperCase().startsWith('DÍ') || activeTab.label.toUpperCase().startsWith('DIA'));
          
          if (!isActualDay) {
            return (
              <section className="surface-card bg-gradient-to-br from-brand-50/50 to-white border-brand-100 p-6 space-y-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto shadow-md">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900">¿Terminaste la Entrada en Calor?</h3>
                  <p className="text-sm font-semibold text-slate-600 max-w-[280px] mx-auto">
                    Excelente. Ahora pasá al bloque de entrenamiento que te toca hoy.
                  </p>
                </div>
                {suggestedDayTab && (
                  <button
                    type="button"
                    className="touch-btn w-full bg-brand-600 hover:bg-brand-700 active:scale-98 shadow-lg shadow-brand-500/10 flex items-center justify-center gap-2 cursor-pointer"
                    onClick={() => setActiveTabId(suggestedDayTab.id)}
                  >
                    Ir a {suggestedDayTab.label}
                  </button>
                )}
              </section>
            );
          }

          const isDayDone = activeTab && completedDays.includes(activeTab.id);

          if (isDayDone) {
            return (
              <section className="surface-card bg-gradient-to-br from-emerald-50/50 to-white border-emerald-100 p-6 space-y-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900">¡{activeTab.label} Terminado!</h3>
                  <p className="text-sm font-semibold text-slate-600 max-w-[280px] mx-auto">
                    Ya marcaste este día como completado. Podés continuar con otro día o finalizar la rutina al terminar la semana.
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary-btn w-full flex items-center justify-center"
                  onClick={() => {
                    if (confirm(`¿Querés volver a marcar ${activeTab.label} como no terminado?`)) {
                      const newCompleted = completedDays.filter(id => id !== activeTab.id);
                      setCompletedDays(newCompleted);
                      localStorage.setItem(`ksc_completed_days_${routineId}`, JSON.stringify(newCompleted));

                      // Decrement completed sessions count for this day/tab
                      const currentCount = completedSessions[activeTab.id] || 0;
                      const newCount = Math.max(0, currentCount - 1);
                      setCompletedSessions(prev => ({ ...prev, [activeTab.id]: newCount }));
                      localStorage.setItem(`ksc_completed_sessions_${routineId}_${activeTab.id}`, String(newCount));
                    }
                  }}
                >
                  Marcar como no completado
                </button>
              </section>
            );
          }

          return (
            <section className="surface-card bg-gradient-to-br from-emerald-50/50 to-white border-emerald-100 p-6 space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">¿Terminaste tu entrenamiento?</h3>
                <p className="text-sm font-semibold text-slate-600 max-w-[280px] mx-auto">
                  Marcá el {activeTab.label} como terminado para registrar tu avance de hoy.
                </p>
              </div>
              <button
                type="button"
                className="touch-btn w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer"
                onClick={() => handleCompleteDay(activeTab.id)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Terminar {activeTab.label}
              </button>
            </section>
          );
        })()}
      </div>

      {/* Selector de tabs: solo en modo normal */}
      {!basicMode && dayTabs.length > 0 ? (
        <div className="fixed bottom-4 left-1/2 z-20 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
          <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-2 shadow-2xl backdrop-blur">
            <div className="flex w-full gap-2 overflow-x-auto no-scrollbar">
              {dayTabs.map((tab) => {
                const isActive = tab.id === activeTab?.id;
                const isCompleted = completedDays.includes(tab.id);
                const isSuggested = suggestedDayTab?.id === tab.id;

                let btnClass = '';
                let labelPrefix = '';
                let labelSuffix = '';

                if (isActive) {
                  btnClass = 'bg-brand-600 text-white shadow-lg shadow-brand-200';
                } else if (isCompleted) {
                  btnClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                  labelSuffix = ' ✓';
                } else if (isSuggested) {
                  btnClass = 'bg-brand-50 text-brand-700 border-2 border-dashed border-brand-300 animate-pulse';
                  labelPrefix = '🎯 ';
                } else {
                  btnClass = 'bg-slate-100 text-slate-600';
                }

                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`flex-1 shrink-0 rounded-2xl px-4 py-3 text-sm font-extrabold uppercase tracking-[0.16em] transition ${btnClass}`}
                    onClick={() => {
                      setActiveTabId(tab.id);
                    }}
                  >
                    {labelPrefix}{tab.label}{labelSuffix}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Botón Terminar rutina fijo al pie en modo básico */}
      {basicMode && !isCompletedState && (
        <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            className="w-full h-16 rounded-2xl bg-emerald-600 text-white font-black text-lg shadow-2xl shadow-emerald-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            onClick={() => {
              if (basicModeActiveDayTab) {
                handleCompleteDay(basicModeActiveDayTab.id);
              }
            }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Terminar {basicModeActiveDayTab?.label || 'día'}
          </button>
        </div>
      )}

      {activeWeightEditor ? (() => {
        const currentWeights = weights[activeWeightEditor.exerciseId] || [];
        const selectedSetValue = currentWeights[activeWeightEditor.setIndex] || '';
        const selectedSetRounds = getSetRounds(selectedSetValue);
        return (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-slate-900/60" onClick={() => setActiveWeightEditor(null)} />
            <div className="absolute inset-x-0 bottom-0 h-[92dvh] rounded-t-3xl bg-white shadow-2xl">
              <div className="flex h-full flex-col">
              <div className="border-b border-slate-100 p-5 pb-3">
                <div className="mb-3 h-1.5 w-12 rounded-full bg-slate-200 mx-auto" />
                <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-700">
                    {activeWeightEditor.exerciseName}
                  </p>
                  <h3 className="text-xl font-extrabold text-slate-900">
                    S{activeWeightEditor.setIndex + 1} · Reps {activeWeightEditor.setReps}
                  </h3>
                  <p className="text-sm font-semibold text-slate-600">
                    Editando Vuelta {(selectedRoundIndex ?? 0) + 1} de {activeWeightEditor.roundsPerSet}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-xl bg-slate-900 px-4 py-2 text-base font-extrabold text-white shadow-lg"
                  onClick={() => setActiveWeightEditor(null)}
                >
                  Cerrar
                </button>
              </div>
              </div>
              <div ref={modalContentRef} className="flex-1 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <div className="mb-4 flex flex-col gap-2">
                {Array.from({ length: activeWeightEditor.roundsPerSet }).map((_, roundIndex) => {
                  const isSelected = selectedRoundIndex === roundIndex;
                  const hasValue = !!selectedSetRounds[roundIndex];
                  return (
                    <button
                      type="button"
                      key={roundIndex}
                      onClick={() => {
                        setSelectedRoundIndex(roundIndex);
                        setRoundInput(selectedSetRounds[roundIndex] || '');
                      }}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition flex justify-between items-center ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20'
                          : hasValue
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/50'
                          : 'border-slate-200 bg-slate-50/70 text-slate-500 hover:bg-slate-100/50'
                      }`}
                    >
                      <span className="font-bold text-sm">Vuelta {roundIndex + 1}</span>
                      <span className="font-black text-base">{selectedSetRounds[roundIndex] || '—'}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-sm font-medium text-slate-600">
                Seleccioná una vuelta para cargar o modificar su peso.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-xl font-bold text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    placeholder={`Peso V${(selectedRoundIndex ?? 0) + 1} (ej: 20)`}
                    value={roundInput}
                    onChange={(e) => setRoundInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveSetRoundWeight(activeWeightEditor.exerciseId, activeWeightEditor.setIndex, activeWeightEditor.roundsPerSet);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="h-12 shrink-0 rounded-lg bg-brand-600 px-4 text-base font-extrabold text-white"
                    onClick={() => saveSetRoundWeight(activeWeightEditor.exerciseId, activeWeightEditor.setIndex, activeWeightEditor.roundsPerSet)}
                  >
                    Guardar
                  </button>
                </div>
                
                {selectedRoundIndex !== null && selectedSetRounds[selectedRoundIndex] && (
                  <button
                    type="button"
                    className="h-11 rounded-xl border border-red-200 bg-red-50 text-sm font-bold text-red-600 hover:bg-red-100/80 transition active:scale-[0.98] flex items-center justify-center gap-1.5"
                    onClick={() => {
                      saveSetRoundWeight(activeWeightEditor.exerciseId, activeWeightEditor.setIndex, activeWeightEditor.roundsPerSet, '');
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Borrar peso de Vuelta {selectedRoundIndex + 1}
                  </button>
                )}
              </div>
              
              {showRoundSavedFeedback ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 animate-pulse">
                  Peso guardado.
                </div>
              ) : null}

              {selectedSetRounds.some(Boolean) && (
                <div className="mt-8 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 text-sm font-extrabold text-slate-500 hover:bg-slate-100 transition active:scale-[0.98]"
                    onClick={() => resetEntireSet(activeWeightEditor.exerciseId, activeWeightEditor.setIndex)}
                  >
                    Restablecer sesión
                  </button>
                </div>
              )}
              </div>
              </div>
            </div>
          </div>
        );
      })() : null}

      {showCompleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" onClick={() => !isCompleting && setShowCompleteConfirmation(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 overflow-hidden animate-slide-up flex flex-col gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto shadow-md">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-slate-900">¿Terminar rutina?</h3>
              <p className="text-sm font-semibold text-slate-500 max-w-[260px] mx-auto">
                Una vez terminada, tu entrenador recibirá la notificación para actualizar tu plan de entrenamiento.
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <button
                type="button"
                className="touch-btn bg-emerald-600 hover:bg-emerald-700 active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={handleCompleteRoutine}
                disabled={isCompleting}
              >
                {isCompleting ? 'Procesando...' : 'Sí, Terminar'}
              </button>
              <button
                type="button"
                className="secondary-btn w-full flex items-center justify-center"
                onClick={() => setShowCompleteConfirmation(false)}
                disabled={isCompleting}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompleteSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-sm bg-white rounded-3xl border border-slate-100 shadow-2xl p-8 overflow-hidden animate-slide-up flex flex-col items-center justify-center text-center gap-4">
            <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/10 border border-emerald-100 animate-bounce">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900">¡Buen trabajo!</h3>
              <p className="text-base font-semibold text-slate-600 max-w-[250px] mx-auto">
                Tu rutina ha sido marcada como terminada.
              </p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">
                Le avisamos a tu entrenador.
              </p>
            </div>
            {basicMode ? (
              <button
                type="button"
                className="mt-2 touch-btn w-full bg-slate-900 text-white font-extrabold"
                onClick={() => setShowCompleteSuccess(false)}
              >
                Entendido
              </button>
            ) : (
              <div className="mt-4 flex items-center gap-2 text-xs font-extrabold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg animate-pulse">
                Redirigiendo al Dashboard...
              </div>
            )}
          </div>
        </div>
      )}

      {showDayCompleteSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-sm bg-white rounded-3xl border border-slate-100 shadow-2xl p-8 overflow-hidden animate-slide-up flex flex-col items-center justify-center text-center gap-4">
            <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/10 border border-emerald-100 animate-bounce">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-950">
                {lastCompletedDayLabel === 'semana' ? '¡Semana completada!' : '¡Buen trabajo!'}
              </h3>
              <p className="text-base font-semibold text-slate-600 max-w-[250px] mx-auto">
                {lastCompletedDayLabel === 'semana' 
                  ? 'Completaste todos los días. Se reinició el progreso de la semana.' 
                  : `Completaste el ${lastCompletedDayLabel}`}
              </p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">
                ¡Seguí así!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reproductor de Video In-App para Ejercicios */}
      {activeVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
            onClick={() => setActiveVideo(null)}
          />
          <div className="relative w-full max-w-2xl bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-2xl overflow-hidden animate-slide-up flex flex-col space-y-4 p-5 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <h3 className="text-lg font-extrabold text-white truncate max-w-[260px] sm:max-w-md">
                  {activeVideo.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveVideo(null)}
                className="w-9 h-9 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition active:scale-90 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-inner">
              <iframe
                src={getYouTubeEmbedUrl(activeVideo.url) || ''}
                title={activeVideo.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>Explicación técnica del ejercicio</span>
              <button
                type="button"
                onClick={() => setActiveVideo(null)}
                className="px-4 py-1.5 rounded-full bg-slate-800 text-white font-bold hover:bg-slate-700 cursor-pointer"
              >
                Cerrar Video
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
