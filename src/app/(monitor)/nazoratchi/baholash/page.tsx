import { MonitoringEvaluationForm } from "../_components/MonitoringEvaluationForm";

export default async function MonitoringBaholashPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; view?: string }>;
}) {
  const params = await searchParams;
  return (
    <MonitoringEvaluationForm
      evaluationId={params.edit}
      readOnly={params.view === "1"}
    />
  );
}
