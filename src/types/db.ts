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
  | (string & {});

export interface University {
  id: string;
  name: string;
  short_code: string;
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
