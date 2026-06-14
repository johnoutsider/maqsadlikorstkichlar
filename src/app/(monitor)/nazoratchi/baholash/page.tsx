import { MonitoringEvaluationForm } from "../_components/MonitoringEvaluationForm";

export default async function MonitoringBaholashPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const params = await searchParams;
  return <MonitoringEvaluationForm evaluationId={params.edit} />;
}
