import { Platform } from 'react-native';

// API Configuration
const API_BASE_URL = __DEV__
  ? Platform.OS === "android"
    ? "http://10.0.2.2:8000/api"  // Android Emulator
    : "http://127.0.0.1:8000/api" // iOS Simulator
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

export interface ChallengeStartResponse {
  attempt_id: number;
  recipe_type: string;
  image_path: string;
  image_url: string;
  options: string[];
}

export interface LearningPathModule {
  id: number;
  title: string;
  challenge_type: string;
  position: number;
  required_exercises: number;
}

export interface LearningPathResponse {
  id: number;
  title: string;
  is_active: boolean;
  modules: LearningPathModule[];
}

export interface ProfileResponse {
  experience_points: number;
  level: number;
  streak: number;
  badges: string[];
}

export interface UserResponse {
  id: number;
  username: string;
  email: string;
  date_joined: string;
  last_login: string | null;
  profile: ProfileResponse | null;
}

// API Service
class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string | null
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Session ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({}));
      throw this.handleError(error);
    }

    return response.json();
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout(token: string, allDevices: boolean = false): Promise<void> {
    await this.request<{ detail: string }>(
      '/auth/logout/',
      {
        method: 'POST',
        body: JSON.stringify({ all_devices: allDevices }),
      },
      token
    );
  }

  async getMe(token: string): Promise<UserResponse> {
    return this.request<UserResponse>('/auth/me/', { method: 'GET' }, token);
  }

  async getLearningPath(token: string | null): Promise<LearningPathResponse> {
    return this.request<LearningPathResponse>(
      '/learning-path/',
      { method: 'GET' },
      token
    );
  }

  async startFindErrorsChallenge(
    token: string,
    recipeType?: string
  ): Promise<ChallengeStartResponse> {
    const params = recipeType ? `?recipe_type=${recipeType}` : '';
    return this.request<ChallengeStartResponse>(
      `/challenges/find-errors/start/${params}`,
      { method: 'POST' },
      token
    );
  }

  async submitFindErrorsAnswer(
    token: string,
    attemptId: number,
    foundError: string
  ): Promise<{ correct: boolean; completed: boolean }> {
    return this.request(
      `/challenges/find-errors/attempt/${attemptId}/submit/`,
      {
        method: 'POST',
        body: JSON.stringify({ found_error: foundError }),
      },
      token
    );
  }

  async startSeparacaoChallenge(
    token: string,
    count?: number
  ): Promise<{
    id: number;
    medications: Array<{ id: number; name: string; category: string }>;
    current_index: number;
    total: number;
  }> {
    const params = count ? `?count=${count}` : '';
    return this.request(
      `/challenges/separacao/start/${params}`,
      { method: 'POST' },
      token
    );
  }

  async submitSeparacaoAnswer(
    token: string,
    attemptId: number,
    medicationId: number,
    chosenCategory: string
  ): Promise<{
    correct: boolean;
    expected: string;
    completed: boolean;
    accuracy: number;
  }> {
    return this.request(
      `/challenges/separacao/attempt/${attemptId}/answer/`,
      {
        method: 'POST',
        body: JSON.stringify({
          medication_id: medicationId,
          chosen_category: chosenCategory,
        }),
      },
      token
    );
  }

  async getAtendimentoExercise(
    token: string
  ): Promise<{
    challenge_id: number;
    customer_scenario: string;
    context_type: string;
  }> {
    return this.request('/challenges/atendimento/', { method: 'GET' }, token);
  }

  async submitAtendimentoResponse(
    token: string,
    challengeId: number,
    responseText: string
  ): Promise<{
    score: number;
    content_score: number;
    clarity_score: number;
    feedback: string[];
  }> {
    return this.request(
      '/challenges/atendimento/submit/',
      {
        method: 'POST',
        body: JSON.stringify({
          challenge_id: challengeId,
          response_text: responseText,
        }),
      },
      token
    );
  }

  private handleError(error: ApiError): Error {
    if (error.email && Array.isArray(error.email)) {
      return new Error(error.email[0]);
    }
    if (error.password && Array.isArray(error.password)) {
      return new Error(error.password[0]);
    }
    if (error.username && Array.isArray(error.username)) {
      return new Error(error.username[0]);
    }
    if (error.detail) {
      return new Error(error.detail);
    }
    return new Error('Ocorreu um erro. Tente novamente.');
  }
}

export const apiService = new ApiService(API_BASE_URL);