export interface RoutineSummary {
  id: string;
  name: string;
  date: string;
  completed?: boolean;
}

export interface LastPaymentSummary {
  amount: number;
  date: string;
}

export interface DashboardData {
  routines: RoutineSummary[];
  lastPayment: LastPaymentSummary | null;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight?: string;
  block?: string;
  blockType?: string;
  videoUrl?: string;
  likeStatus?: 'like' | 'dislike' | null;
}

export interface RoutineBlock {
  id: string;
  name: string;
  type: string;
  rounds?: string;
  exercises: Exercise[];
}

export interface RoutineDetail {
  id: string;
  name: string;
  date: string;
  blocks: RoutineBlock[];
  completed?: boolean;
}

export interface Member {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  birthDate?: string;
  joinDate?: string;
  dni?: string;
  address?: string;
  gender?: string;
  medicalConditions?: string;
  fitnessLevel?: string;
  fitnessGoal?: string;
  referralSource?: string;
  notes?: string;
  completedDays?: number;
}

export interface Payment {
  id: number;
  amount: number;
  monthPeriod: string;
  paymentDate: string;
  paymentMethod: string;
  status: string;
  notes?: string | null;
}

