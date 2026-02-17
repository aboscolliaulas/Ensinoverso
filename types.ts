
export enum AppView {
  DASHBOARD = 'dashboard',
  CLASSES = 'turmas',
  LESSON_PLANNER = 'aulas',
  SETTINGS = 'config',
  VISUALS = 'visuals',
  QUIZ_MAKER = 'quiz',
  CHAT = 'chat'
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface StudentPerformance {
  studentId: string;
  studentName: string;
  scorePercentage: number;
}

export interface QuestionStat {
  questionIndex: number;
  correctRate: number;
}

export interface LessonPerformance {
  classId: string;
  className: string;
  averageScore: number;
  studentScores: StudentPerformance[];
  questionStats: QuestionStat[];
}

export interface BNCCSkill {
  id: string;
  code: string;
  description: string;
  grade: string;
  subject: string;
}

export type UserRole = 'administrador' | 'professor' | 'estudante';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  approved: boolean;
  linkedClassIds: string[];
  completedLessonIds?: string[]; // IDs das aulas que o aluno já respondeu
}

export interface LessonPlan {
  id: string;
  ownerId: string;
  title: string;
  subject: string;
  grade: string;
  schoolName: string;
  teacherName: string;
  objectives: string[];
  content: string;
  activities: string[];
  assessment: string;
  extraMaterials?: string[];
  bnccSkills: string;
  questions?: QuizQuestion[];
  linkedClassIds?: string[];
  performances?: LessonPerformance[];
}

export interface GeneratedImage {
  url: string;
  prompt: string;
}

export interface Student {
  id: string;
  name: string;
  avatar?: string;
}

export interface ClassLesson {
  id: string;
  title: string;
  date: string;
  category: string;
}

export interface ClassRoom {
  id: string;
  name: string;
  grade: string;
  studentsCount: number;
  color: string;
  icon: string;
  imageUrl?: string;
  students?: Student[];
  lessons?: ClassLesson[];
}
