export interface SurveyOverviewItem {
  SurveyId: string;
  Title: string;
  StartDate: string;
  EndDate: string;
  Status: "Draft" | "Active" | "Closed" | "Archived" | string;
  AssignedAdminName?: string | null;
  TargetRespondents: number | null;
  TargetScore: number | null;
  CurrentScore: number | null;
  RespondentCount: number;
  UpdatedAt?: string | null;
  CreatedAt?: string | null;
}

export interface SurveysResponse {
  success: boolean;
  surveys: SurveyOverviewItem[];
  message?: string;
  error?: string;
}
