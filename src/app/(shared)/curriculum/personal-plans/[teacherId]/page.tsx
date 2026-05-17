import { unstable_cache } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { planStaticTag } from "@/lib/cache-tags";
import { PlanView } from "./PlanView";
import type {
  AcademicYear, StudyGroup, Subject, SubjectWorkload,
  Teacher, TeacherAllocation, TeacherWorkPlan, WorkPlanApprovalLog,
} from "@/types/db";

interface StaticData {
  subjects: Subject[];
  groups: StudyGroup[];
  workloads: SubjectWorkload[];
  activeYear: AcademicYear | null;
}

function getStaticData(universityId: string): Promise<StaticData> {
  return unstable_cache(
    async (): Promise<StaticData> => {
      // Must use admin client here — cookies() cannot be called inside unstable_cache.
      // Security: universityId is verified from user session before this is called,
      // and all queries are filtered by it.
      const supabase = createAdminClient();
      const [subjectsRes, groupsRes, yearRes] = await Promise.all([
        supabase.from("subjects").select("*").eq("university_id", universityId).order("name"),
        supabase.from("study_groups").select("*").eq("university_id", universityId).order("name"),
        supabase.from("academic_years").select("*").eq("university_id", universityId).eq("is_active", true).single(),
      ]);

      const subjects = (subjectsRes.data as Subject[]) ?? [];
      const subjectIds = subjects.map(s => s.id);

      const workloadsRes = subjectIds.length
        ? await supabase.from("subject_workloads").select("*").in("subject_id", subjectIds)
        : { data: [] };

      return {
        subjects,
        groups: (groupsRes.data as StudyGroup[]) ?? [],
        workloads: (workloadsRes.data as SubjectWorkload[]) ?? [],
        activeYear: (yearRes.data as AcademicYear | null) ?? null,
      };
    },
    [`plan-static-${universityId}`],
    { revalidate: 300, tags: [planStaticTag(universityId)] }
  )();
}

export default async function TeacherPlanPage({
  params,
}: {
  params: { teacherId: string };
}) {
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, university_id, roles!inner(name)")
    .eq("id", authUser.id)
    .single();

  const universityId = (profile as any)?.university_id as string | null;
  const role = (profile as any)?.roles?.name as string ?? "";

  if (!universityId) notFound();

  const [teacherRes, staticData] = await Promise.all([
    supabase.from("teachers").select("*").eq("id", params.teacherId).single(),
    getStaticData(universityId),
  ]);

  const teacher = teacherRes.data as Teacher | null;
  if (!teacher || (teacher as any).university_id !== universityId) notFound();

  // Live data — never cached, always fresh
  let plan: TeacherWorkPlan | null = null;
  let allocations: TeacherAllocation[] = [];
  let approvalLogs: WorkPlanApprovalLog[] = [];

  if (staticData.activeYear) {
    const { data: planData } = await supabase
      .from("teacher_work_plans")
      .select("*")
      .eq("teacher_id", params.teacherId)
      .eq("academic_year_id", staticData.activeYear.id)
      .maybeSingle();

    plan = (planData as TeacherWorkPlan | null) ?? null;

    if (plan) {
      const [allocRes, logRes] = await Promise.all([
        supabase
          .from("teacher_allocations")
          .select("*")
          .eq("work_plan_id", plan.id)
          .order("created_at"),
        supabase
          .from("work_plan_approval_logs")
          .select("*")
          .eq("work_plan_id", plan.id)
          .order("created_at", { ascending: false }),
      ]);
      allocations   = (allocRes.data  as TeacherAllocation[])    ?? [];
      approvalLogs  = (logRes.data    as WorkPlanApprovalLog[])  ?? [];
    }
  }

  const currentUser = {
    id: authUser.id,
    role,
    university_id: universityId,
    display_name: (profile as any)?.display_name as string ?? "",
  };

  return (
    <PlanView
      teacher={teacher}
      plan={plan}
      allocations={allocations}
      approvalLogs={approvalLogs}
      subjects={staticData.subjects}
      groups={staticData.groups}
      workloads={staticData.workloads}
      activeYear={staticData.activeYear}
      currentUser={currentUser}
    />
  );
}
