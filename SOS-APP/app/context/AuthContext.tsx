import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  UserRole,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
} from "../types";
import apiService from "../services/api";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  userRole: UserRole | null;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  // Check if user is already logged in on app start
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await apiService.getToken();
      if (token) {
        // Token exists, retrieve stored user role
        const storedRole = await apiService.getUserRole();
        if (storedRole) {
          setUserRole(storedRole as UserRole);
          setIsAuthenticated(true);
        } else {
          // Token exists but no role - invalid state, clear everything
          await apiService.removeToken();
          setIsAuthenticated(false);
          setUserRole(null);
        }
      } else {
        setIsAuthenticated(false);
        setUserRole(null);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsAuthenticated(false);
      setUserRole(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (data: LoginRequest) => {
    try {
      const response: AuthResponse = await apiService.login(data);
      console.log("Login response:", response);
      if (!response.token) {
        console.warn("Token is missing from response:", response);
        throw new Error("No token received from server");
      }
      await apiService.saveToken(response.token);
      await apiService.saveUserRole(response.role);
      setUserRole(response.role);
      setIsAuthenticated(true);
    } catch (error: any) {
      console.error("Login failed:", error);
      setIsAuthenticated(false);
      setUserRole(null);
      throw new Error(
        error.response?.data?.message || error.message || "Login failed"
      );
    }
  };

  const register = async (data: RegisterRequest) => {
    try {
      const response: AuthResponse = await apiService.register(data);
      console.log("Register response:", response);
      if (!response.token) {
        console.warn("Token is missing from response:", response);
        throw new Error("No token received from server");
      }
      await apiService.saveToken(response.token);
      await apiService.saveUserRole(response.role);
      setUserRole(response.role);
      setIsAuthenticated(true);
    } catch (error: any) {
      console.error("Registration failed:", error);
      setIsAuthenticated(false);
      setUserRole(null);
      throw new Error(
        error.response?.data?.message || error.message || "Registration failed"
      );
    }
  };

  const logout = async () => {
    try {
      await apiService.removeToken();
      await apiService.removeUserRole();
      setIsAuthenticated(false);
      setUserRole(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        userRole,
        login,
        register,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
