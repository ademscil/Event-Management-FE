export interface UserListItem {
  UserId: string;
  Username: string;
  DisplayName: string;
  Email: string;
  Role: "SuperAdmin" | "AdminEvent" | "ITLead" | "DepartmentHead" | string;
  UseLDAP: boolean;
  IsActive: boolean;
  BusinessUnitId?: string | null;
  DivisionId?: string | null;
  DepartmentId?: string | null;
  BusinessUnitName?: string | null;
  DivisionName?: string | null;
  DepartmentName?: string | null;
  CreatedAt: string;
  UpdatedAt: string | null;
}

export interface UsersResponse {
  success: boolean;
  users: UserListItem[];
  message?: string;
  error?: string;
}
