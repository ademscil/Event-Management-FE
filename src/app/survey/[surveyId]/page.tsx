import SurveyClient from "./survey-client";

export default async function PublicSurveyPage({
  params,
}: {
  params: Promise<{ surveyId: string }>;
}) {
  const { surveyId } = await params;
  return <SurveyClient surveyId={surveyId} />;
}
