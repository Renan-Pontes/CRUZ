import { Platform } from 'react-native';

// API Configuration
// Para Android Emulator: use 10.0.2.2
// Para iOS Simulator: use localhost ou 127.0.0.1
// Para dispositivo físico: use o IP da sua máquina na rede local
const API_BASE_URL = __DEV__
  ? Platform.OS === "android"
    ? "http://127.0.0.1:8000/api"
    : "http://127.0.0.1:8000/api"
  : "https://your-production-api.com/api";

// Types
export interface RegisterRequest {
  email: string;
  password: string;
  username?: string;
}

export interface AuthResponse {
  token: string;
  expires_at: string;
  user_id: number;
  email: string;
}

export interface ApiError {
  detail?: string;
  email?: string[];
  password?: string[];
  username?: string[];
  [key: string]: any;
}

// API Service
class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw this.handleError(error);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erro ao conectar com o servidor');
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw this.handleError(error);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erro ao conectar com o servidor');
    }
  }

  async logout(token: string, allDevices: boolean = false): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/logout/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Session ${token}`,
        },
        body: JSON.stringify({ all_devices: allDevices }),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw this.handleError(error);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erro ao conectar com o servidor');
    }
  }

  private handleError(error: ApiError): Error {
    // Handle specific field errors
    if (error.email && Array.isArray(error.email)) {
      return new Error(error.email[0]);
    }
    if (error.password && Array.isArray(error.password)) {
      return new Error(error.password[0]);
    }
    if (error.username && Array.isArray(error.username)) {
      return new Error(error.username[0]);
    }
    
    // Handle general error
    if (error.detail) {
      return new Error(error.detail);
    }

    // Fallback error message
    return new Error('Ocorreu um erro. Tente novamente.');
  }
}

export const apiService = new ApiService(API_BASE_URL);
