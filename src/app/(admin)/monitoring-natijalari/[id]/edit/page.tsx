import { MonitoringEvaluationForm } from "@/app/(monitor)/nazoratchi/_components/MonitoringEvaluationForm";

export default async function ScienceDepartmentMonitoringEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MonitoringEvaluationForm evaluationId={id} readOnly />;
}
