export type UserRole = "super_admin" | "admin" | "staff_manager";
export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
export type SubmissionStatus =
  | "draft"
  | "pending"
  | "pending_dean"
  | "pending_science"
  | "needs_revision"
  | "approved"
  | "rejected";
export type NotificationType = "submission_submitted" | "submission_approved" | "submission_rejected" | "target_set" | "user_created";
export type ThemeMode = "light" | "dark" | "system";

export interface UserDoc {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  facultyId: string | null;
  departmentId: string | null;
  telegramChatId: string | null;
  createdAt: Date;
  createdBy: string;
}

export interface DepartmentDoc {
  id: string;          // e.g. "ENG1_AF1"
  name: string;        // e.g. "Ingliz tili amaliy fanlar №1"
  facultyId: string;   // parent faculty ID
  shortCode: string;
}

export interface FacultyDoc {
  id: string;          // e.g. "ENG1"
  name: string;        // e.g. "Ingliz tili №1 fakulteti"
  shortCode: string;
}

export interface IndicatorDoc {
  id: string;          // e.g. "ind1", "ind12a"
  no: string;          // "1", "12a"
  name: string;        // Uzbek name
  unit: string;        // "%", "nafar", "dona", "mln. so'm"
  order: number;
  isSubIndicator: boolean;
}

export interface TargetDoc {
  id: string;          // "ENG1_AF1_2025_Q1"
  facultyId: string;
  departmentId: string;
  year: number;
  quarter: Quarter;
  createdBy: string;
  createdAt: Date;
  values: Record<string, number | null>;  // ind1..ind19
}

export interface IndicatorSubmission {
  value: number | null;
  files: string[];     // Storage download URLs
}

export interface SubmissionDoc {
  id: string;
  facultyId: string;
  departmentId: string;
  year: number;
  quarter: Quarter;
  submittedBy: string;
  status: SubmissionStatus;
  submittedAt: Date | null;
  updatedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewComment: string | null;
  indicators: Record<string, IndicatorSubmission>;
}

export interface NotificationDoc {
  id: string;
  recipientId: string;        // userId who should see this notification
  type: NotificationType;
  title: string;              // Uzbek title
  message: string;            // Uzbek message body
  data: {                     // Contextual data for linking
    facultyId?: string;
    submissionId?: string;
    year?: number;
    quarter?: Quarter;
  };
  read: boolean;
  createdAt: Date;
}
