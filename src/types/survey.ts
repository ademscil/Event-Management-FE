export interface SurveyOverviewItem {
  SurveyId: string;
  Title: string;
  StartDate: string;
  EndDate: string;
  Status: "Draft" | "Active" | "Closed" | "Archived" | string;
  AssignedAdminName?: string | null;
  AssignedAdminNames?: string[];
  AssignedAdminIds?: string[];
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

export interface SurveyConfiguration {
  ConfigId?: string;
  HeroTitle?: string | null;
  HeroSubtitle?: string | null;
  HeroImageUrl?: string | null;
  LogoUrl?: string | null;
  BackgroundColor?: string | null;
  BackgroundImageUrl?: string | null;
  PrimaryColor?: string | null;
  SecondaryColor?: string | null;
  FontFamily?: string | null;
  ButtonStyle?: string | null;
  ShowProgressBar?: boolean;
  ShowPageNumbers?: boolean;
  MultiPage?: boolean;
}

export interface SurveyQuestion {
  QuestionId: string;
  SurveyId: string;
  Type: string;
  PromptText: string;
  Subtitle?: string | null;
  IsMandatory?: boolean;
  DisplayOrder?: number;
  PageNumber?: number;
  LayoutOrientation?: "vertical" | "horizontal" | string;
  Options?: unknown;
}

export interface SurveyDetail extends SurveyOverviewItem {
  Description?: string | null;
  AssignedAdminId?: string | null;
  SurveyLink?: string | null;
  ShortenedLink?: string | null;
  QRCodeDataUrl?: string | null;
  EmbedCode?: string | null;
  DuplicatePreventionEnabled?: boolean;
  configuration?: SurveyConfiguration;
  questions?: SurveyQuestion[];
}
