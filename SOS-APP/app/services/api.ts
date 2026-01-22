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

class ApiService {
  private api: AxiosInstance;

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

    // Response interceptor - Handle 401 errors
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid - clear storage
          await AsyncStorage.removeItem(TOKEN_KEY);
          // You can emit an event here to trigger logout in AuthContext
        }
        return Promise.reject(error);
      }
    );
  }

  // ==================== AUTH APIs ====================
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await this.api.post<AuthResponse>("/auth/register", data);
    console.log("Register response:", response);
    return response.data;
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.api.post<AuthResponse>("/auth/login", data);
    return response.data;
  }

  async saveToken(token: string | undefined): Promise<void> {
    if (!token) {
      console.warn(
        "Attempted to save empty or undefined token. Use removeToken() instead."
      );
      return;
    }
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }

  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem(TOKEN_KEY);
  }

  async removeToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
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
}

export default new ApiService();
