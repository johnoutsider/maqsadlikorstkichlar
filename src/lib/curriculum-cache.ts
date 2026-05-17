import type {
  AcademicYear, Department, Faculty, StudyGroup, Subject, Teacher, TeacherAllocation, TeacherWorkPlan,
} from "@/types/db";

export interface CurriculumSnapshot {
  teachers: Teacher[];
  plans: TeacherWorkPlan[];
  allocations: TeacherAllocation[];
  years: AcademicYear[];
  departments: Department[];
  faculties: Faculty[];
  subjects: Subject[];
  groups: StudyGroup[];
}

// Module-level cache — survives client-side navigations within the same session.
// Keyed by university_id. TTL: 2 minutes.
const STORE = new Map<string, { data: CurriculumSnapshot; ts: number }>();
const TTL = 2 * 60 * 1000;

export function cacheGet(universityId: string): CurriculumSnapshot | null {
  const entry = STORE.get(universityId);
  if (!entry || Date.now() - entry.ts > TTL) return null;
  return entry.data;
}

export function cacheSet(universityId: string, data: CurriculumSnapshot): void {
  STORE.set(universityId, { data, ts: Date.now() });
}

export function cacheInvalidate(universityId: string): void {
  STORE.delete(universityId);
}
