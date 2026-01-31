import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_CONFIG } from "../config";
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  ClientProfile,
  DriverProfile,
  SOSRequest,
  SOSResponse,
  AvailabilityRequest,
  LocationUpdateRequest,
} from "../types";

const TOKEN_KEY = "@sos_token";
const USER_ROLE_KEY = "@sos_user_role";
const TOKEN_EXPIRY_KEY = "@sos_token_expiry";

class ApiService {
  private api: AxiosInstance;
  private refreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor() {
    this.api = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor - Add JWT token to requests
    this.api.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - Handle 401 errors with retry
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const { config, response } = error;
        const originalRequest = config;

        // Handle 401 Unauthorized
        if (response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          if (!this.refreshing) {
            this.refreshing = true;

            try {
              // Try to refresh token (if backend supports it)
              // For now, clear storage and let user re-login
              await this.removeToken();
              await this.removeUserRole();

              // Emit logout event (implement via EventEmitter if needed)
              if (API_CONFIG.ENABLE_LOGGING) {
                console.log("Token expired, user logged out");
              }
            } catch (refreshError) {
              console.error("Token refresh failed:", refreshError);
            } finally {
              this.refreshing = false;
              this.refreshSubscribers = [];
            }
          }

          return Promise.reject(error);
        }

        return Promise.reject(error);
      }
    );
  }

  // ==================== AUTH APIs ====================
  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await this.api.post<AuthResponse>(
        "/auth/register",
        data
      );
      if (API_CONFIG.ENABLE_LOGGING) {
        console.log("✅ Registration successful");
      }
      return response.data;
    } catch (error: any) {
      if (API_CONFIG.ENABLE_LOGGING) {
        console.error("❌ Registration failed:", error.response?.data?.message);
      }
      throw error;
    }
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await this.api.post<AuthResponse>("/auth/login", data);
      if (API_CONFIG.ENABLE_LOGGING) {
        console.log("✅ Login successful");
      }
      return response.data;
    } catch (error: any) {
      if (API_CONFIG.ENABLE_LOGGING) {
        console.error("❌ Login failed:", error.response?.data?.message);
      }
      throw error;
    }
  }

  async saveToken(token: string | undefined): Promise<void> {
    if (!token) {
      console.warn("Attempted to save empty token. Use removeToken() instead.");
      return;
    }
    await AsyncStorage.setItem(TOKEN_KEY, token);

    // Store token expiry time (default: 1 hour from now)
    const expiryTime = Date.now() + 3600000;
    await AsyncStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  }

  async getToken(): Promise<string | null> {
    const token = await AsyncStorage.getItem(TOKEN_KEY);

    if (!token) return null;

    // Check if token is expired
    const expiryTimeStr = await AsyncStorage.getItem(TOKEN_EXPIRY_KEY);
    if (expiryTimeStr) {
      const expiryTime = parseInt(expiryTimeStr, 10);
      if (Date.now() > expiryTime) {
        await this.removeToken();
        return null;
      }
    }

    return token;
  }

  async removeToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(TOKEN_EXPIRY_KEY);
  }

  async saveUserRole(role: string): Promise<void> {
    await AsyncStorage.setItem(USER_ROLE_KEY, role);
  }

  async getUserRole(): Promise<string | null> {
    return await AsyncStorage.getItem(USER_ROLE_KEY);
  }

  async removeUserRole(): Promise<void> {
    await AsyncStorage.removeItem(USER_ROLE_KEY);
  }

  // ==================== CLIENT APIs ====================
  async createOrUpdateClientProfile(
    data: ClientProfile
  ): Promise<ClientProfile> {
    const response = await this.api.post<ClientProfile>(
      "/client/profile",
      data
    );
    return response.data;
  }

  async getClientProfile(): Promise<ClientProfile> {
    const response = await this.api.get<ClientProfile>("/client/profile");
    return response.data;
  }

  // ==================== DRIVER APIs ====================
  async createOrUpdateDriverProfile(
    data: DriverProfile
  ): Promise<DriverProfile> {
    const response = await this.api.post<DriverProfile>(
      "/driver/profile",
      data
    );
    return response.data;
  }

  async getDriverProfile(): Promise<DriverProfile> {
    const response = await this.api.get<DriverProfile>("/driver/profile");
    return response.data;
  }

  async updateDriverAvailability(
    data: AvailabilityRequest
  ): Promise<DriverProfile> {
    const response = await this.api.post<DriverProfile>(
      "/driver/availability",
      data
    );
    return response.data;
  }

  async updateDriverLocation(
    data: LocationUpdateRequest
  ): Promise<DriverProfile> {
    const response = await this.api.post<DriverProfile>(
      "/driver/location",
      data
    );
    return response.data;
  }

  // ==================== SOS APIs ====================
  async createSOS(data: SOSRequest): Promise<SOSResponse> {
    const response = await this.api.post<SOSResponse>("/sos", data);
    return response.data;
  }

  async getNearbySOS(
    lat: number,
    lng: number,
    radius: number = 5
  ): Promise<SOSResponse[]> {
    const response = await this.api.get<SOSResponse[]>("/sos/nearby", {
      params: { lat, lng, radius },
    });
    return response.data;
  }

  async acceptSOS(sosId: number): Promise<SOSResponse> {
    const response = await this.api.post<SOSResponse>(`/sos/${sosId}/accept`);
    return response.data;
  }

  async getSOS(sosId: number): Promise<SOSResponse> {
    const response = await this.api.get<SOSResponse>(`/sos/${sosId}`);
    return response.data;
  }

  async markPatientArrived(sosId: number): Promise<SOSResponse> {
    console.log(
      `📍 [API] POST /sos/${sosId}/arrived - Marking patient as arrived`
    );
    const response = await this.api.post<SOSResponse>(`/sos/${sosId}/arrived`);
    console.log(`✅ [API] Patient arrived response:`, response.data);
    return response.data;
  }

  async completeSOS(sosId: number): Promise<SOSResponse> {
    console.log(`🏁 [API] POST /sos/${sosId}/complete - Completing SOS`);
    const response = await this.api.post<SOSResponse>(`/sos/${sosId}/complete`);
    console.log(`✅ [API] SOS completed response:`, response.data);
    return response.data;
  }

  async cancelSOS(sosId: number): Promise<SOSResponse> {
    console.log(`❌ [API] POST /sos/${sosId}/cancel - Cancelling SOS`);
    const response = await this.api.post<SOSResponse>(`/sos/${sosId}/cancel`);
    console.log(`✅ [API] SOS cancelled response:`, response.data);
    return response.data;
  }
}

export default new ApiService();
