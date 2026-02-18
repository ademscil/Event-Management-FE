import { login, logout, validateSession, getCurrentUser } from "@/lib/auth";

export const AuthApi = {
  login,
  logout,
  validateSession,
  getCurrentUser,
};
