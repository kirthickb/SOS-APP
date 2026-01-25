export enum UserRole {
  CLIENT = "CLIENT",
  DRIVER = "DRIVER",
}

export enum SOSStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  ARRIVED = "ARRIVED", // Driver picked up patient
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  role: UserRole;
}

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  phone: string;
  password: string;
  role: UserRole;
}

export interface ClientProfile {
  id?: number;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  address: string;
  city: string;
  state: string;
  relativeName: string;
  relativePhone: string;
  medicalNotes?: string;
}

export interface DriverProfile {
  id?: number;
  vehicleNumber: string;
  serviceCity: string;
  isAvailable?: boolean;
  currentLatitude?: number;
  currentLongitude?: number;
}

export interface SOSRequest {
  latitude: number;
  longitude: number;
}

export interface SOSResponse {
  id: number;
  clientName: string;
  clientPhone: string;
  latitude: number;
  longitude: number;
  status: SOSStatus;
  acceptedDriverName?: string;
  acceptedDriverPhone?: string;
  driverLatitude?: number;
  driverLongitude?: number;
  createdAt: string;
}

export interface Location {
  latitude: number;
  longitude: number;
}

export interface AvailabilityRequest {
  isAvailable: boolean;
}

export interface LocationUpdateRequest {
  latitude: number;
  longitude: number;
}
