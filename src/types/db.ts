// Hand-written types matching supabase/migrations/0001_init.sql.
// You can replace this later with `supabase gen types typescript` output.

export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
export type SubmissionStatus =
  | "draft"
  | "pending"           // legacy — maps to pending_dean
  | "pending_dean"
  | "pending_science"
  | "needs_revision"
  | "approved"
  | "rejected";

export type ReviewStage = "dean" | "science";

export interface IndicatorReviewDecision {
  status: "approved" | "rejected";
  comment: string | null;
  by: string;       // reviewer user id
  at: string;       // ISO timestamp
}

export interface IndicatorReviewEntry {
  dean: IndicatorReviewDecision | null;
  science: IndicatorReviewDecision | null;
}

export interface ReviewHistoryEntry {
  stage: ReviewStage;
  reviewer_id: string;
  at: string;
  outcome: "advanced" | "needs_revision" | "approved";
  overall_comment?: string | null;
  decisions: Array<{
    indicator_id: string;
    status: "approved" | "rejected";
    comment: string | null;
  }>;
}
export type RoleScope = "global" | "university" | "faculty" | "department";

// Built-in role names — but the `roles` table is the source of truth and can grow.
export type RoleName =
  | "super_admin"
  | "university_admin"
  | "vice_rector"
  | "science_department"
  | "dean"
  | "staff_manager"
  | "doktorant"
  | "supervisor"
  | (string & {});

export interface University {
  id: string;
  name: string;
  short_code: string;
  logo_url: string | null;
  login_logo_url: string | null;
  created_at: string;
}

export interface Role {
  id: string;
  name: RoleName;
  description: string | null;
  scope: RoleScope;
  created_at: string;
}

export interface AppUser {
  id: string;
  university_id: string | null;
  role_id: string;
  faculty_id: string | null;
  department_id: string | null;
  display_name: string;
  email: string;
  must_change_password: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Faculty {
  id: string;
  university_id: string;
  name: string;
  short_code: string;
  dean_user_id: string | null;
  created_at: string;
}

export interface Department {
  id: string;
  university_id: string;
  faculty_id: string;
  name: string;
  short_code: string;
  created_at: string;
}

export interface Indicator {
  id: string;
  university_id: string;
  no: string;
  name: string;
  unit: string;
  order_idx: number;
  is_sub_indicator: boolean;
  created_at: string;
}

export interface Target {
  id: string;
  university_id: string;
  faculty_id: string;
  department_id: string;
  year: number;
  quarter: Quarter;
  values: Record<string, number | null>;
  created_by: string | null;
  created_at: string;
}

export interface IndicatorSubmission {
  value: number | null;
  files: string[]; // storage paths within `submissions` bucket
}

export interface Submission {
  id: string;
  university_id: string;
  faculty_id: string;
  department_id: string;
  year: number;
  quarter: Quarter;
  status: SubmissionStatus;
  submitted_by: string;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  indicators: Record<string, IndicatorSubmission>;
  indicator_reviews: Record<string, IndicatorReviewEntry>;
  review_history: ReviewHistoryEntry[];
  updated_at: string;
  created_at: string;
}

export interface Notification {
  id: string;
  university_id: string | null;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

// Enriched user used by the auth context — joins role + scope info.
export interface CurrentUser extends AppUser {
  role: RoleName;
  role_scope: RoleScope;
}

export interface Supervisor {
  id: string;
  auth_user_id: string;
  university_id: string | null;
  faculty_id: string | null;
  department_id: string | null;
  full_name: string;
  staff_id: string;
  academic_title: string;
  workplace: string | null;
  is_external: boolean;
  email: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ThesisStatus = "taklif" | "jarayonda" | "korib_chiqilmoqda" | "himoyalangan" | "yakunlangan";

export interface Doktorant {
  id: string;
  auth_user_id: string;
  university_id: string;
  faculty_id: string | null;
  department_id: string | null;
  supervisor_id: string | null;
  full_name: string;
  student_id: string;
  enrollment_year: number;
  research_topic: string;
  thesis_status: ThesisStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type RecommendationStatus = "davom_etsin" | "qayta_korib_chiqsin" | "muddatni_uzaytirsin";

export interface Evaluation {
  id: string;
  doktorant_id: string;
  supervisor_id: string;
  period_start: string;
  period_end: string;
  overall_rating: number;
  research_progress: string;
  strengths: string | null;
  areas_to_improve: string | null;
  recommendation: RecommendationStatus;
  comments: string | null;
  created_at: string;
}

export type IlmiyDaraja = 'fan_doktori' | 'fan_nomzodi' | 'phd' | 'yoq';
export type IlmiyUnvon  = 'professor' | 'dotsent' | 'katta_oqituvchi' | 'oqituvchi' | 'assistent';
export type Stavka      = '0.25' | '0.5' | '0.75' | '1.0' | '1.25' | '1.5';
export type IshTuri     = 'asosiy' | 'orindosh';
export type FaoliyatHolati = 'faol' | 'ishdan_ketgan' | 'tatilda';

export interface Teacher {
  id: string;
  university_id: string;
  faculty_id: string;
  department_id: string;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  birth_date: string | null;
  gender: 'erkak' | 'ayol' | null;
  phone: string | null;
  email: string | null;
  passport_pinfl: string | null;
  ilmiy_daraja: IlmiyDaraja | null;
  ilmiy_unvon: IlmiyUnvon | null;
  lavozim: string | null;
  stavka: Stavka | null;
  ish_turi: IshTuri | null;
  ishga_kirgan_sana: string | null;
  faoliyat_holati: FaoliyatHolati;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgressReport {
  id: string;
  doktorant_id: string;
  period_start: string;
  period_end: string;
  description: string;
  file_urls: string[];
  supervisor_feedback: string | null;
  feedback_at: string | null;
  created_at: string;
}
