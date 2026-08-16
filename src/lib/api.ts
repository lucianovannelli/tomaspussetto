import type { DashboardData, RoutineDetail, Member, Payment } from './types';

const API_BASE = import.meta.env.PUBLIC_KSC_API_BASE ?? 'https://ksc.lucianovannelli.workers.dev/api/mobile';
export function isDemoMode(): boolean {
  if (typeof window === 'undefined') {
    return import.meta.env.PUBLIC_KSC_DEMO_MODE === 'true';
  }
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('demo') === 'true') {
    localStorage.setItem('ksc_demo_mode', 'true');
    return true;
  }
  return localStorage.getItem('ksc_demo_mode') === 'true' || import.meta.env.PUBLIC_KSC_DEMO_MODE === 'true';
}

export function isBasicMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('ksc_basic_mode') === 'true';
}

export function setBasicMode(value: boolean): void {
  if (value) {
    localStorage.setItem('ksc_basic_mode', 'true');
  } else {
    localStorage.removeItem('ksc_basic_mode');
  }
}


const ENABLE_MOCKS = import.meta.env.DEV || import.meta.env.PUBLIC_KSC_ENABLE_MOCKS === 'true' || isDemoMode();

function fallbackDashboard(memberId: string): DashboardData {
  let completedList: string[] = [];
  if (typeof window !== 'undefined') {
    try {
      completedList = JSON.parse(localStorage.getItem('ksc_completed_routines') || '[]');
    } catch (e) {
      console.error('Error parsing completed routines', e);
    }
  }

  return {
    routines: [
      {
        id: 'fuerza-1',
        name: isDemoMode() ? 'Día 1 - Fuerza Torso (Empuje/Tracción)' : `Plan Fuerza - Alumno ${memberId}`,
        date: new Date().toISOString().split('T')[0],
        completed: completedList.includes('fuerza-1')
      },
      {
        id: 'piernas-2',
        name: isDemoMode() ? 'Día 2 - Piernas & Core (Foco Cadera)' : 'Plan Piernas y Core',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        completed: completedList.includes('piernas-2')
      },
      {
        id: 'cardio-3',
        name: isDemoMode() ? 'Día 3 - Acondicionamiento Metabólico (AMRAP)' : 'Plan Acondicionamiento',
        date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        completed: completedList.includes('cardio-3')
      }
    ],
    lastPayment: {
      amount: 25000,
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  };
}

function fallbackRoutine(id: string): RoutineDetail {
  let completedList: string[] = [];
  if (typeof window !== 'undefined') {
    try {
      completedList = JSON.parse(localStorage.getItem('ksc_completed_routines') || '[]');
    } catch (e) {
      console.error('Error parsing completed routines', e);
    }
  }
  const isCompleted = completedList.includes(id);

  if (id === 'fuerza-1') {
    return {
      id: 'fuerza-1',
      name: 'Día 1 - Fuerza Torso (Empuje/Tracción)',
      date: new Date().toISOString().split('T')[0],
      completed: isCompleted,
      blocks: [
        {
          id: 'w1',
          name: 'ENTRADA EN CALOR - Movilidad y Activación',
          type: 'warmup',
          rounds: 'x2',
          exercises: [
            {
              id: 'w_cat_camel',
              name: 'Cat-Camel (Gato/Bueno)',
              sets: 2,
              reps: '10',
              weight: '',
              videoUrl: 'https://www.youtube.com/watch?v=w_UK7lRz1Zk'
            },
            {
              id: 'w_band_pull',
              name: 'Band Pull-Apart (Aperturas con banda)',
              sets: 2,
              reps: '15',
              weight: '',
              videoUrl: 'https://www.youtube.com/watch?v=Fo_o5sPZzG4'
            }
          ]
        },
        {
          id: 'b1',
          name: 'BLOQUE A - Fuerza Principal',
          type: 'day',
          rounds: 'x4',
          exercises: [
            {
              id: 'bench_press',
              name: 'Press de Banca Plano con Barra',
              sets: 4,
              reps: '8, 8, 6, 6',
              weight: '50, 52.5, 55, 55',
              videoUrl: 'https://www.youtube.com/watch?v=rT7DgCr-3pg'
            },
            {
              id: 'pull_up',
              name: 'Dominadas Pronas (Asistidas)',
              sets: 4,
              reps: '8, 8, 8, 8',
              weight: '15, 15, 10, 10',
              videoUrl: 'https://www.youtube.com/watch?v=eGo4IYlbE5g'
            }
          ]
        },
        {
          id: 'b2',
          name: 'BLOQUE B - Accesorios de Torso',
          type: 'day',
          rounds: 'x3',
          exercises: [
            {
              id: 'db_shoulder_press',
              name: 'Press Militar sentado con Mancuernas',
              sets: 3,
              reps: '10, 10, 10',
              weight: '12.5, 12.5, 15',
              videoUrl: 'https://www.youtube.com/watch?v=qEwKCR5JCog'
            },
            {
              id: 'db_row',
              name: 'Serrucho / Remo unilateral con Mancuerna',
              sets: 3,
              reps: '12, 10, 10',
              weight: '15, 17.5, 17.5',
              videoUrl: 'https://www.youtube.com/watch?v=pYcpY20QaE8'
            }
          ]
        }
      ]
    };
  }

  if (id === 'piernas-2') {
    return {
      id: 'piernas-2',
      name: 'Día 2 - Piernas & Core (Foco Cadera)',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      completed: isCompleted,
      blocks: [
        {
          id: 'w2',
          name: 'ENTRADA EN CALOR - Movilidad de Cadera y Tobillo',
          type: 'warmup',
          rounds: 'x2',
          exercises: [
            {
              id: 'w_goblet_squat_hold',
              name: 'Goblet Squat Hold (Isometría abajo)',
              sets: 2,
              reps: '30 seg',
              weight: '12'
            },
            {
              id: 'w_glute_bridge',
              name: 'Puente de Glúteos con banda',
              sets: 2,
              reps: '15',
              weight: ''
            }
          ]
        },
        {
          id: 'b3',
          name: 'BLOQUE A - Fuerza Tren Inferior',
          type: 'day',
          rounds: 'x4',
          exercises: [
            {
              id: 'back_squat',
              name: 'Sentadilla Trasera con Barra (Back Squat)',
              sets: 4,
              reps: '10, 8, 8, 6',
              weight: '60, 65, 70, 75'
            },
            {
              id: 'romanian_deadlift',
              name: 'Peso Muerto Rumano con Barra',
              sets: 4,
              reps: '10, 10, 8, 8',
              weight: '50, 60, 65, 70'
            }
          ]
        },
        {
          id: 'b4',
          name: 'BLOQUE B - Estabilidad y Core',
          type: 'day',
          rounds: 'x3',
          exercises: [
            {
              id: 'plank',
              name: 'Plancha Prona con Disco en espalda',
              sets: 3,
              reps: '45 seg, 45 seg, 45 seg',
              weight: '10, 15, 15'
            },
            {
              id: 'ab_wheel',
              name: 'Rueda Abdominal (Desplazamientos)',
              sets: 3,
              reps: '12, 10, 10',
              weight: '0, 0, 0'
            }
          ]
        }
      ]
    };
  }

  if (id === 'cardio-3') {
    return {
      id: 'cardio-3',
      name: 'Día 3 - Acondicionamiento Metabólico (AMRAP)',
      date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      completed: isCompleted,
      blocks: [
        {
          id: 'w3',
          name: 'ENTRADA EN CALOR - Activación Cardiovascular',
          type: 'warmup',
          rounds: 'x1',
          exercises: [
            {
              id: 'w_jumping_jacks',
              name: 'Jumping Jacks (Monigotes)',
              sets: 1,
              reps: '60 seg',
              weight: ''
            }
          ]
        },
        {
          id: 'b5',
          name: 'BLOQUE ÚNICO - AMRAP 20 Minutos',
          type: 'day',
          rounds: 'x5',
          exercises: [
            {
              id: 'kettlebell_swing',
              name: 'Kettlebell Swings Rusos',
              sets: 5,
              reps: '20, 20, 20, 20, 20',
              weight: '16, 20, 20, 24, 24'
            },
            {
              id: 'burpees',
              name: 'Burpees Pecho al Piso',
              sets: 5,
              reps: '10, 10, 10, 10, 10',
              weight: '0, 0, 0, 0, 0'
            },
            {
              id: 'rower',
              name: 'Remo Concept2 (Calorías / Metros)',
              sets: 5,
              reps: '250m, 250m, 250m, 250m, 250m',
              weight: ''
            }
          ]
        }
      ]
    };
  }

  return {
    id,
    name: `Rutina ${id}`,
    date: '2026-02-13',
    completed: isCompleted,
    blocks: [
      {
        id: 'b1',
        name: 'DÍA 1 - Circuito 1',
        type: 'day',
        rounds: 'x4',
        exercises: [
          {
            id: 'sentadilla',
            name: 'Sentadilla libre',
            sets: 4,
            reps: '8-10',
            weight: '40 kg'
          }
        ]
      }
    ]
  };
}

export async function fetchDashboard(memberId: string): Promise<DashboardData> {
  if (isDemoMode()) {
    return fallbackDashboard(memberId);
  }
  try {
    const response = await fetch(`${API_BASE}/routines?member_id=${encodeURIComponent(memberId)}`);
    if (!response.ok) throw new Error('No se pudo cargar la lista de rutinas.');
    return (await response.json()) as DashboardData;
  } catch {
    if (ENABLE_MOCKS) {
      return fallbackDashboard(memberId);
    }

    throw new Error('No se pudo cargar la lista de rutinas.');
  }
}

export async function fetchRoutine(id: string): Promise<RoutineDetail> {
  if (isDemoMode()) {
    return fallbackRoutine(id);
  }
  try {
    const response = await fetch(`${API_BASE}/routine/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error('No se pudo cargar la rutina.');
    return (await response.json()) as RoutineDetail;
  } catch {
    if (ENABLE_MOCKS) {
      return fallbackRoutine(id);
    }

    throw new Error('No se pudo cargar la rutina.');
  }
}

export async function saveExerciseWeight(routineId: string, exerciseId: string, weight: string) {
  if (isDemoMode()) {
    console.log('Demo Mode: Simulating saving weight', { routineId, exerciseId, weight });
    return new Promise((resolve) => setTimeout(() => resolve({ success: true, exerciseId, weight }), 300));
  }
  const response = await fetch(`${API_BASE}/routine/${encodeURIComponent(routineId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ exerciseId, weight })
  });

  if (!response.ok) {
    throw new Error('No se pudo guardar el peso.');
  }

  return (await response.json()) as { success: boolean; exerciseId: string; weight: string };
}

export async function fetchMember(memberId: string): Promise<Member> {
  if (isDemoMode() || memberId === '999') {
    return {
      firstName: 'Lautaro',
      lastName: 'Demo',
      email: 'lautaro.demo@tomaspussetto.com',
      phone: '3416554433',
      birthDate: '1995-08-25',
      joinDate: '2026-05-04',
      dni: '38123456',
      address: 'Av. Pellegrini 1500, Rosario',
      gender: 'Masculino',
      medicalConditions: 'Ninguna',
      fitnessLevel: 'Intermedio',
      fitnessGoal: 'Fuerza e Hipertrofia',
      referralSource: 'Instagram',
      notes: 'Socio de demostración para pruebas visuales.'
    };
  }
  try {
    const response = await fetch(`${API_BASE}/member?id=${encodeURIComponent(memberId)}`);
    if (!response.ok) throw new Error('No se pudo cargar la información del socio.');
    return (await response.json()) as Member;
  } catch {
    return {
      firstName: 'Socio',
      lastName: memberId,
      email: '',
      phone: '',
      birthDate: '',
      dni: '',
      address: '',
      gender: '',
      medicalConditions: '',
      fitnessLevel: '',
      fitnessGoal: '',
      referralSource: '',
      notes: ''
    };
  }
}

export async function updateMember(memberId: string, payload: Partial<Member>): Promise<boolean> {
  if (isDemoMode()) {
    console.log('Demo Mode: Simulating profile update', { memberId, payload });
    return new Promise((resolve) => setTimeout(() => resolve(true), 300));
  }
  const response = await fetch(`${API_BASE}/member`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id: memberId, ...payload })
  });

  return response.ok;
}

export async function updateMemberPhone(memberId: string, phone: string): Promise<boolean> {
  if (isDemoMode()) {
    console.log('Demo Mode: Simulating phone update', { memberId, phone });
    return new Promise((resolve) => setTimeout(() => resolve(true), 300));
  }
  const response = await fetch(`${API_BASE}/member`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id: memberId, phone })
  });

  return response.ok;
}

export async function updateMemberBirthDate(memberId: string, birthDate: string): Promise<boolean> {
  if (isDemoMode()) {
    console.log('Demo Mode: Simulating birth date update', { memberId, birthDate });
    return new Promise((resolve) => setTimeout(() => resolve(true), 300));
  }
  const response = await fetch(`${API_BASE}/member`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id: memberId, birthDate })
  });

  return response.ok;
}

export async function submitFeedback(memberId: string, rating: number, comment?: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: memberId, rating, comment })
    });
    return response.ok;
  } catch {
    if (ENABLE_MOCKS) {
      console.log('Mock Feedback Submitted:', { memberId, rating, comment });
      return new Promise((resolve) => setTimeout(() => resolve(true), 600));
    }
    return false;
  }
}

export async function completeRoutine(routineId: string): Promise<boolean> {
  if (isDemoMode()) {
    console.log('Demo Mode: Simulating routine completion', { routineId });
    try {
      const completedRoutines = JSON.parse(localStorage.getItem('ksc_completed_routines') || '[]');
      if (!completedRoutines.includes(routineId)) {
        completedRoutines.push(routineId);
        localStorage.setItem('ksc_completed_routines', JSON.stringify(completedRoutines));
      }
    } catch (e) {
      console.error('Error saving completed routine to localStorage', e);
    }
    return new Promise((resolve) => setTimeout(() => resolve(true), 600));
  }
  try {
    const response = await fetch(`${API_BASE}/routine/${encodeURIComponent(routineId)}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ completed: true })
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to complete routine via API', error);
    return false;
  }
}

export async function saveExerciseLikeStatus(routineId: string, exerciseId: string, likeStatus: 'like' | 'dislike' | null): Promise<boolean> {
  if (isDemoMode()) {
    console.log('Demo Mode: Simulating saving exercise like status', { routineId, exerciseId, likeStatus });
    return new Promise((resolve) => setTimeout(() => resolve(true), 300));
  }
  try {
    const response = await fetch(`${API_BASE}/routine/${encodeURIComponent(routineId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ exerciseId, likeStatus })
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to save exercise like status via API', error);
    return false;
  }
}

export async function fetchMemberPayments(memberId: string): Promise<Payment[]> {
  if (isDemoMode() || memberId === '999') {
    return [
      {
        id: 1,
        amount: 25000,
        monthPeriod: '2026-05',
        paymentDate: '2026-05-05',
        paymentMethod: 'Efectivo',
        status: 'paid',
        notes: 'Pago mensualidad estándar.'
      },
      {
        id: 2,
        amount: 25000,
        monthPeriod: '2026-04',
        paymentDate: '2026-04-06',
        paymentMethod: 'Transferencia',
        status: 'paid',
        notes: null
      },
      {
        id: 3,
        amount: 20000,
        monthPeriod: '2026-03',
        paymentDate: '2026-03-05',
        paymentMethod: 'Efectivo',
        status: 'paid',
        notes: 'Descuento por promo.'
      }
    ];
  }
  try {
    const response = await fetch(`${API_BASE}/payments?member_id=${encodeURIComponent(memberId)}`);
    if (!response.ok) throw new Error('No se pudo cargar la lista de pagos.');
    return (await response.json()) as Payment[];
  } catch (error) {
    if (ENABLE_MOCKS) {
      return [
        {
          id: 1,
          amount: 25000,
          monthPeriod: '2026-05',
          paymentDate: '2026-05-05',
          paymentMethod: 'Efectivo',
          status: 'paid',
          notes: 'Pago mensual de prueba (fallback)'
        }
      ];
    }
    throw error;
  }
}

export function getYouTubeEmbedUrl(url: string | undefined): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube-nocookie.com/embed/${match[2]}?autoplay=1&modestbranding=1&rel=0`;
  }
  return url;
}


