import { useEffect, useMemo, useState } from 'react';
import { fetchDashboard, fetchMember, updateMember, isDemoMode, fetchMemberPayments, isBasicMode, setBasicMode } from '../lib/api';
import type { LastPaymentSummary, RoutineSummary, Member, Payment } from '../lib/types';
import { navigate } from 'astro:transitions/client';
import SatisfactionSensor from './SatisfactionSensor';

const STORAGE_KEY = 'tp_member_id';
const FALLBACK_STORAGE_KEY = 'ksc_member_id';

function formatDate(dateValue: string) {
  try {
    const hasTime = dateValue.includes('T') || dateValue.includes(':');
    const date = hasTime ? new Date(dateValue) : new Date(`${dateValue}T00:00:00`);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateValue;
  }
}

function getMonthsDifference(dateStr: string): number {
  if (!dateStr) return 0;
  try {
    const joinDate = new Date(`${dateStr}T00:00:00`);
    if (isNaN(joinDate.getTime())) return 0;
    
    const now = new Date();
    const yearsDiff = now.getFullYear() - joinDate.getFullYear();
    const monthsDiff = now.getMonth() - joinDate.getMonth();
    let totalMonths = yearsDiff * 12 + monthsDiff;
    
    if (now.getDate() < joinDate.getDate()) {
      totalMonths--;
    }
    return Math.max(0, totalMonths);
  } catch {
    return 0;
  }
}

function calculateJoinDate(months: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const targetMonthIndex = d.getMonth() - months;
  d.setMonth(targetMonthIndex);
  
  const expectedMonth = ((now.getMonth() - months) % 12 + 12) % 12;
  if (d.getMonth() !== expectedMonth) {
    d.setDate(0);
  }
  
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function DashboardView() {
  const [memberId, setMemberId] = useState('');
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const [lastPayment, setLastPayment] = useState<LastPaymentSummary | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [birthDateParts, setBirthDateParts] = useState({ day: '', month: '', year: '' });
  const [trainingMonths, setTrainingMonths] = useState('');
  const [profileForm, setProfileForm] = useState<Member>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    joinDate: '',
    dni: '',
    address: '',
    referralSource: ''
  });
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);
  const [activeTab, setActiveTab] = useState<'rutinas' | 'mis-datos'>('rutinas');
  const [basicMode, setBasicModeState] = useState(() => isBasicMode());

  useEffect(() => {
    const url = new URL(window.location.href);
    const memberIdFromQuery = url.searchParams.get('member_id');
    const storedMemberId = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(FALLBACK_STORAGE_KEY);
    const resolvedMemberId = (memberIdFromQuery || storedMemberId || '').trim();

    if (!resolvedMemberId || !/^\d+$/.test(resolvedMemberId)) {
      navigate('/login', { history: 'replace' });
      return;
    }

    localStorage.setItem(STORAGE_KEY, resolvedMemberId);
    setMemberId(resolvedMemberId);

    Promise.all([
      fetchDashboard(resolvedMemberId),
      fetchMember(resolvedMemberId)
    ])
      .then(([dashboardData, memberData]) => {
        setRoutines(dashboardData.routines);
        setLastPayment(dashboardData.lastPayment);
        setMember(memberData);
        setProfileForm({
          firstName: memberData.firstName || '',
          lastName: memberData.lastName || '',
          email: memberData.email || '',
          phone: memberData.phone || '',
          birthDate: memberData.birthDate || '',
          joinDate: memberData.joinDate || '',
          dni: memberData.dni || '',
          address: memberData.address || '',
          referralSource: memberData.referralSource || ''
        });
        const [year = '', month = '', day = ''] = (memberData.birthDate || '').split('-');
        setBirthDateParts({ day, month, year });
        if (memberData.joinDate) {
          setTrainingMonths(String(getMonthsDifference(memberData.joinDate)));
        } else {
          setTrainingMonths('0');
        }
        // Auto-redirect en modo básico: ir directo a la última rutina
        if (isBasicMode() && dashboardData.routines.length > 0) {
          navigate(`/routine/${dashboardData.routines[0].id}`, { history: 'replace' });
        }
      })
      .catch(() => {
        setError('No pudimos cargar tu información ahora.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Refresh dashboard on active tab switch
  useEffect(() => {
    if (!memberId || loading) return;
    
    fetchDashboard(memberId)
      .then((dashboardData) => {
        setRoutines(dashboardData.routines);
        setLastPayment(dashboardData.lastPayment);
      })
      .catch(() => {});
  }, [activeTab, memberId, loading]);

  // Refresh dashboard on window focus / visibility change
  useEffect(() => {
    if (!memberId || loading) return;

    const handleFocus = () => {
      fetchDashboard(memberId)
        .then((dashboardData) => {
          setRoutines(dashboardData.routines);
          setLastPayment(dashboardData.lastPayment);
        })
        .catch(() => {});
    };

    window.addEventListener('focus', handleFocus);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [memberId, loading]);

  const emptyState = useMemo(() => !loading && !error && routines.length === 0, [loading, error, routines.length]);

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('ksc_demo_mode');
    navigate('/login', { history: 'replace' });
  };

  const handleUpdateProfile = async () => {
    const day = birthDateParts.day.trim();
    const month = birthDateParts.month.trim();
    const year = birthDateParts.year.trim();
    const hasAnyBirthDatePart = day || month || year;
    const hasCompleteBirthDate = day.length === 2 && month.length === 2 && year.length === 4;

    if (hasAnyBirthDatePart && !hasCompleteBirthDate) {
      alert('Completá la fecha de nacimiento en formato DD/MM/AAAA.');
      return;
    }

    const birthDate = hasCompleteBirthDate ? `${year}-${month}-${day}` : '';
    const monthsNum = parseInt(trainingMonths, 10);
    const joinDate = isNaN(monthsNum) ? profileForm.joinDate : calculateJoinDate(monthsNum);
    const payload: Member = { ...profileForm, birthDate, joinDate };

    setSavingProfile(true);
    const success = await updateMember(memberId, payload);
    if (success) {
      setMember(payload);
      setEditingProfile(false);
      if (isDemoMode()) {
        alert('Simulado: Tus cambios se aplicaron localmente en esta sesión de demo.');
      }
    } else {
      alert('No se pudieron actualizar tus datos.');
    }
    setSavingProfile(false);
  };

  const handleShowPayments = async () => {
    if (!memberId) return;
    setShowPaymentsModal(true);
    setLoadingPayments(true);
    setPaymentsError('');
    try {
      const data = await fetchMemberPayments(memberId);
      setPayments(data);
    } catch (err) {
      console.error('Error loading payments:', err);
      setPaymentsError('No pudimos cargar tu historial de pagos.');
    } finally {
      setLoadingPayments(false);
    }
  };

  const formattedLastPaymentDate = lastPayment ? formatDate(lastPayment.date) : '';
  const formattedLastPaymentAmount = lastPayment
    ? new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0
      }).format(lastPayment.amount)
    : '';

  const daysSinceLastPayment = lastPayment
    ? Math.floor((Date.now() - new Date(lastPayment.date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const canPay = daysSinceLastPayment >= 28;

  return (
    <section className="space-y-4">
      <header className="surface-card space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="brand-badge" style={{ viewTransitionName: 'brand-logo' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#f5f0e8', flexShrink: 0 }}>
                  <path d="M13 2L4.09 12.97H11L10 22L20.09 11.03H13L13 2Z" />
                </svg>
                <span className="badge-text">Tomás Pussetto</span>
              </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              Hola, {member ? `${member.firstName} ${member.lastName}` : 'Alumna'}
              {isDemoMode() && (
                <span className="inline-flex items-center rounded-full bg-[#26160d]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#26160d]">Demo</span>
              )}
            </h1>
          </div>
          <button type="button" className="ghost-btn shrink-0" onClick={handleLogout}>
            Cerrar sesion
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex rounded-2xl bg-slate-100 p-1 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('rutinas')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-extrabold uppercase tracking-wider transition-all ${
            activeTab === 'rutinas'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Rutinas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('mis-datos')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-extrabold uppercase tracking-wider transition-all ${
            activeTab === 'mis-datos'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Mis Datos
        </button>
      </div>

      {/* Tab: Rutinas */}
      {activeTab === 'rutinas' && (
        <>
          {loading ? (
            <p className="surface-card text-base font-medium text-slate-700">Cargando rutinas...</p>
          ) : null}

          {error ? (
            <p className="surface-card text-base font-medium text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          {emptyState ? (
            <p className="surface-card text-base font-medium text-slate-700">No hay rutinas disponibles por ahora.</p>
          ) : null}

          <ul className="space-y-3" aria-live="polite">
            {routines.map((routine) => {
              const isCompleted = !!routine.completed;
              return (
                <li 
                  key={routine.id} 
                  className={`surface-card space-y-3 transition-all relative overflow-hidden ${
                    isCompleted 
                      ? 'border-emerald-200 bg-emerald-50/20 shadow-emerald-500/5' 
                      : ''
                  }`}
                >
                  {isCompleted && (
                    <div className="absolute top-0 left-0 h-1 w-full bg-emerald-500" />
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-slate-900">{routine.name}</h2>
                      {isCompleted && (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                          Terminada ✓
                        </span>
                      )}
                    </div>
                    <p className="text-base font-medium text-slate-700">Fecha: {formatDate(routine.date)}</p>
                  </div>
                  <a 
                    href={`/routine/${routine.id}`} 
                    className={`touch-btn ${isCompleted ? 'bg-slate-800 hover:bg-slate-900' : ''}`}
                  >
                    {isCompleted ? 'Ver rutina' : 'Ver'}
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Tab: Mis Datos */}
      {activeTab === 'mis-datos' && (
        <div className="space-y-4">
          {member && (
            <>
              <section className="surface-card space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-700">Mi perfil</p>
                    <p className="text-lg font-bold text-slate-900">
                      {member.firstName} {member.lastName}
                    </p>
                  </div>
                  {!editingProfile && (
                    <button
                      className="text-sm font-bold text-brand-600 underline"
                      onClick={() => setEditingProfile(true)}
                    >
                      Editar
                    </button>
                  )}
                </div>

                {!editingProfile && (
                  <div className="flex items-center gap-3 bg-brand-50/50 border border-brand-100/50 rounded-2xl p-4">
                    <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center text-xl shrink-0">
                      💪
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-brand-700">Mi Progreso</p>
                      <p className="text-xl font-black text-slate-800">
                        {member.completedDays ?? 0} {member.completedDays === 1 ? 'día entrenado' : 'días entrenados'}
                      </p>
                    </div>
                  </div>
                )}

                {editingProfile ? (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 gap-3">
                      <label className="space-y-1.5">
                        <span className="text-sm font-bold text-slate-600">Nombre</span>
                        <input className="touch-input" value={profileForm.firstName || ''} onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))} />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-sm font-bold text-slate-600">Apellido</span>
                        <input className="touch-input" value={profileForm.lastName || ''} onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))} />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-sm font-bold text-slate-600">Email</span>
                        <input type="email" className="touch-input" value={profileForm.email || ''} onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))} />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-sm font-bold text-slate-600">WhatsApp / Teléfono</span>
                        <input type="tel" className="touch-input" value={profileForm.phone || ''} onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))} />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-sm font-bold text-slate-600">Fecha de nacimiento</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={2}
                            placeholder="DD"
                            className="touch-input w-1/4 min-w-0 text-center"
                            value={birthDateParts.day}
                            onChange={(e) => setBirthDateParts((prev) => ({ ...prev, day: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                          />
                          <span className="font-bold text-slate-500">/</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={2}
                            placeholder="MM"
                            className="touch-input w-1/4 min-w-0 text-center"
                            value={birthDateParts.month}
                            onChange={(e) => setBirthDateParts((prev) => ({ ...prev, month: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                          />
                          <span className="font-bold text-slate-500">/</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="AAAA"
                            className="touch-input w-2/4 min-w-0 text-center"
                            value={birthDateParts.year}
                            onChange={(e) => setBirthDateParts((prev) => ({ ...prev, year: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                          />
                        </div>
                      </label>
                      <label className="space-y-1.5 block">
                        <span className="text-sm font-bold text-slate-600">¿Hace cuánto entrenás?</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            className="touch-input w-24 text-center font-bold text-lg"
                            value={trainingMonths}
                            onChange={(e) => setTrainingMonths(e.target.value.replace(/\D/g, ''))}
                          />
                          <span className="text-sm font-bold text-slate-500">meses</span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium mt-1">
                          Equivale a la fecha de ingreso:{' '}
                          <span className="font-extrabold text-slate-600">
                            {trainingMonths !== '' ? formatDate(calculateJoinDate(Number(trainingMonths))) : '—'}
                          </span>
                        </p>
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-sm font-bold text-slate-600">DNI</span>
                        <input className="touch-input" value={profileForm.dni || ''} onChange={(e) => setProfileForm((prev) => ({ ...prev, dni: e.target.value }))} />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-sm font-bold text-slate-600">Dirección</span>
                        <input className="touch-input" value={profileForm.address || ''} onChange={(e) => setProfileForm((prev) => ({ ...prev, address: e.target.value }))} />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-sm font-bold text-slate-600">Cómo nos conoció</span>
                        <input className="touch-input" value={profileForm.referralSource || ''} onChange={(e) => setProfileForm((prev) => ({ ...prev, referralSource: e.target.value }))} />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button className="touch-btn" onClick={handleUpdateProfile} disabled={savingProfile}>
                        {savingProfile ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                      <button
                        className="secondary-btn"
                        onClick={() => {
                          setEditingProfile(false);
                          setProfileForm(member);
                          const [year = '', month = '', day = ''] = (member.birthDate || '').split('-');
                          setBirthDateParts({ day, month, year });
                          if (member.joinDate) {
                            setTrainingMonths(String(getMonthsDifference(member.joinDate)));
                          } else {
                            setTrainingMonths('0');
                          }
                        }}
                        disabled={savingProfile}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                      <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                        <p><strong>ID de socia:</strong> {memberId}</p>
                        <p><strong>Días entrenados:</strong> {member.completedDays ?? 0}</p>
                        <p><strong>Email:</strong> {member.email || '—'}</p>
                        <p><strong>Teléfono:</strong> {member.phone || '—'}</p>
                        <p><strong>Nacimiento:</strong> {member.birthDate ? formatDate(member.birthDate) : '—'}</p>
                        <p><strong>Fecha de ingreso:</strong> {member.joinDate ? formatDate(member.joinDate) : '—'}</p>
                        <p><strong>DNI:</strong> {member.dni || '—'}</p>
                        <p><strong>Dirección:</strong> {member.address || '—'}</p>
                        <p><strong>Cómo nos conoció:</strong> {member.referralSource || '—'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleShowPayments}
                        className="touch-btn w-full mt-3 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold"
                      >
                        💳 Mis pagos
                      </button>

                      {/* Toggle Modo Básico */}
                      <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                        <div className="space-y-0.5">
                          <p className="text-sm font-extrabold text-slate-900">Modo Básico</p>
                          <p className="text-xs font-medium text-slate-500">Al ingresar, abre directamente tu última rutina</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={basicMode}
                          onClick={() => {
                            const next = !basicMode;
                            setBasicMode(next);
                            setBasicModeState(next);
                          }}
                          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 focus:outline-none ${
                            basicMode ? 'bg-brand-600' : 'bg-slate-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                              basicMode ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </>
                )}
              </section>

              {/* Tarjeta de Coach y Feedback */}
              <section className="surface-card space-y-3 border border-[#e6dfd5] bg-[#faf7f2]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#26160d] text-[#f5f0e8] flex items-center justify-center text-lg shadow-sm shrink-0">
                    💪
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#26160d]">Entrenamiento con Tomás</h3>
                    <p className="text-xs text-[#5e4e43] font-medium">Método ENDS. Diseñado especialmente para vos.</p>
                  </div>
                </div>
              </section>
            </>
          )}

          {lastPayment ? (
            <section className="surface-card space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#26160d]">Último pago de cuota</p>
                <h2 className="text-xl font-extrabold text-slate-900">{formattedLastPaymentAmount}</h2>
              </div>
              <p className="text-base font-medium text-slate-700">Fecha: {formattedLastPaymentDate}</p>
              {canPay && (
                <div className="space-y-3 pt-1">
                  <button
                    type="button"
                    className="touch-btn w-full"
                    onClick={() => setShowPaymentInfo(v => !v)}
                  >
                    {showPaymentInfo ? 'Cerrar' : 'Pagar cuota / Plan'}
                  </button>
                  {showPaymentInfo && (
                    <div className="rounded-xl bg-[#faf7f2] border border-[#e6dfd5] p-4 space-y-3">
                      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#26160d]">Datos de pago</p>
                      <div className="space-y-1.5">
                        <p className="text-sm font-medium text-slate-700">Monto: <span className="font-extrabold text-slate-900">{formattedLastPaymentAmount}</span></p>
                        <p className="text-sm font-medium text-slate-700">Alias: <span className="font-extrabold text-slate-900 select-all">tomas.pussetto</span></p>
                        <p className="text-sm font-medium text-slate-700">Enviar comprobante al: <span className="font-extrabold text-slate-900">3417559988</span></p>
                      </div>
                      <a
                        href={`https://wa.me/543417559988?text=Hola%20Tom%C3%A1s%2C%20te%20env%C3%ADo%20el%20comprobante%20de%20pago%20de%20${encodeURIComponent(formattedLastPaymentAmount)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="touch-btn w-full flex items-center justify-center"
                      >
                        Enviar comprobante por WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              )}
            </section>
          ) : null}
        </div>
      )}

      {showPaymentsModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowPaymentsModal(false)}
          />
          
          {/* Bottom Sheet Card */}
          <div className="relative z-10 w-full max-w-md bg-white rounded-t-[32px] border-t border-slate-200 shadow-2xl p-6 space-y-6 animate-slide-up max-h-[75vh] flex flex-col">
            {/* Grabber indicator for bottom sheet */}
            <div className="mx-auto w-12 h-1.5 bg-slate-200 rounded-full cursor-pointer" onClick={() => setShowPaymentsModal(false)} />
            
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Mis Pagos</h3>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">Historial de mensualidades</p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowPaymentsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 active:scale-90 transition cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-1 pb-4">
              {loadingPayments ? (
                <p className="text-sm font-medium text-slate-500 text-center py-6 animate-pulse">Cargando pagos...</p>
              ) : paymentsError ? (
                <p className="text-sm font-medium text-red-500 text-center py-6">{paymentsError}</p>
              ) : payments && payments.length > 0 ? (
                payments.map((pay) => {
                  let formattedPeriod = pay.monthPeriod;
                  if (pay.monthPeriod && pay.monthPeriod.includes('-')) {
                    try {
                      const [year, month] = pay.monthPeriod.split('-');
                      const date = new Date(Number(year), Number(month) - 1, 1);
                      const monthName = date.toLocaleDateString('es-AR', { month: 'long' });
                      formattedPeriod = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
                    } catch {}
                  }
                  
                  const formattedAmount = new Intl.NumberFormat('es-AR', {
                    style: 'currency',
                    currency: 'ARS',
                    maximumFractionDigits: 0
                  }).format(pay.amount);

                  return (
                    <div key={pay.id} className="flex flex-col p-4 bg-slate-50 border border-slate-100 rounded-2xl animate-fade-in gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-base font-extrabold text-slate-900">{formattedPeriod}</span>
                          <span className="text-xs font-medium text-slate-500 mt-0.5">
                            Pago: {formatDate(pay.paymentDate)}
                          </span>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <span className="text-base font-black text-slate-900">{formattedAmount}</span>
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-100">
                            Pagado
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-200/60 pt-2 mt-1">
                        <span>Método: {pay.paymentMethod}</span>
                        {pay.notes && (
                          <span className="text-right italic truncate max-w-[60%]">{pay.notes}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm font-medium text-slate-500 text-center py-6">No tenés pagos registrados.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {memberId && <SatisfactionSensor memberId={memberId} />}
    </section>
  );
}
