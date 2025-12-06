import Constants from "expo-constants";
import { Platform } from "react-native";

// ============================================
// API SERVICE - Serviço completo de API
// Coloque em: frontend/services/api.ts
// ============================================

// ⚠️ CONFIG: defina o host do backend
// - EXPO_PUBLIC_API_URL => host/porta do backend (sem /api)
// - Se não setar, usa 10.0.2.2 (Android emulador) ou 127.0.0.1 (iOS/web)
const DEFAULT_API_HOST = Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://127.0.0.1:8000";
const API_HOST =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  DEFAULT_API_HOST;
const API_URL = API_HOST.replace(/\/$/, "");
export const API_BASE_URL = API_URL;

const REQUEST_TIMEOUT_MS = 10000;

// ============================================
// TIPOS
// ============================================

// Auth
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  password_confirm: string;
}

export interface AuthSessionResponse {
  token: string;
  expires_at: string;
  user_id: number;
}

// Profile
export interface ProfileSummary {
  experience_points: number;
  level: number;
  streak: number;
  badges?: string[];
}

export interface Badge {
  id: number;
  name: string;
  description: string;
  icon: string;
  earned_at?: string;
}

export interface MeResponse {
  id: number;
  username: string;
  email: string;
  date_joined: string;
  last_login: string | null;
  profile: ProfileSummary | null;
  sessions: any[];
  awarded_badges: Badge[];
}

export interface ProfileDetailResponse {
  profile: {
    experience_points: number;
    level: number;
    streak: number;
    badges: Badge[];
  };
  awarded_badges: Badge[];
}

// Learning Path
export interface PathModule {
  id: number;
  title: string;
  challenge_type: "find_errors" | "separacao" | "atendimento";
  position: number;
  required_exercises: number;
}
export type LearningPathModule = PathModule;

export interface LearningPathResponse {
  id: number;
  title: string;
  is_active: boolean;
  modules: PathModule[];
}

// Activity
export interface ActivityLog {
  id: number;
  activity_type: "login" | "challenge_started" | "challenge_completed" | "badge_earned" | "level_up" | "custom";
  message: string;
  details: any;
  created_at: string;
}

// Challenges - Find Errors
export interface FindErrorsExercise {
  attempt_id: number;
  prescription_id: number;
  prescription_type: "A" | "B" | "C";
  image_url: string;
  total_errors: number;
  found_errors: number;
}

export interface FindErrorsSubmitRequest {
  attempt_id: number;
  x: number;
  y: number;
}

export interface FindErrorsSubmitResponse {
  correct: boolean;
  message: string;
  found_errors: number;
  total_errors: number;
  completed: boolean;
  xp_earned?: number;
}

// Challenges - Separação
export interface Medication {
  id: number;
  name: string;
  category: string;
}

export interface SeparacaoAttempt {
  attempt_id: number;
  medications: Medication[];
  current_index: number;
  correct_count: number;
  total_count: number;
}

export interface SeparacaoAnswerRequest {
  category: string;
}

export interface SeparacaoStepResult {
  correct: boolean;
  correct_category: string;
  next_index: number;
  completed: boolean;
  accuracy?: number;
  xp_earned?: number;
  final_score?: number;
}

// Challenges - Atendimento
export interface AtendimentoExercise {
  challenge_id: number;
  customer_scenario: string;
  context_type: string;
}

export interface AtendimentoSubmitRequest {
  challenge_id: number;
  response_text: string;
}

export interface AtendimentoResult {
  score: number;
  feedback: string;
  content_score: number;
  clarity_score: number;
  xp_earned: number;
  badges_earned: Badge[];
}

// Leaderboard
export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  experience_points: number;
  level: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export class ApiError extends Error {
  status?: number;
  details?: any;

  constructor(message: string, status?: number, details?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("Tempo limite da requisição atingido. Confira a URL/IP do backend.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.detail || errorData.message || `Erro ${response.status}`;
    if (response.status === 401 || response.status === 403) {
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
      throw new ApiError("Sessão inválida ou expirada.", response.status, errorData);
    }
    throw new ApiError(message, response.status, errorData);
  }
  return response.json();
}

function authHeaders(token: string): HeadersInit {
  return {
    "Authorization": `Session ${token}`,
    "Content-Type": "application/json",
  };
}

// ============================================
// API SERVICE
// ============================================

export const apiService = {
  // ==========================================
  // AUTH
  // ==========================================

  /**
   * Login com email e senha
   * POST /api/auth/login/
   */
  async login(email: string, password: string): Promise<AuthSessionResponse> {
    const response = await fetchWithTimeout(`${API_URL}/api/auth/login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<AuthSessionResponse>(response);
  },

  /**
   * Registrar novo usuário
   * POST /api/auth/register/
   */
  async register(email: string, password: string, passwordConfirm: string): Promise<AuthSessionResponse> {
    const response = await fetchWithTimeout(`${API_URL}/api/auth/register/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        password_confirm: passwordConfirm,
      }),
    });
    return handleResponse<AuthSessionResponse>(response);
  },

  /**
   * Logout - invalida token
   * POST /api/auth/logout/
   */
  async logout(token: string, allDevices: boolean = false): Promise<void> {
    const response = await fetchWithTimeout(`${API_URL}/api/auth/logout/`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ all_devices: allDevices }),
    });
    
    if (!response.ok) {
      console.log("Erro no logout, mas continuando...");
    }
  },

  /**
   * Buscar dados do usuário logado
   * GET /api/auth/me/
   */
  async getMe(token: string): Promise<MeResponse> {
    const response = await fetchWithTimeout(`${API_URL}/api/auth/me/`, {
      method: "GET",
      headers: authHeaders(token),
    });
    return handleResponse<MeResponse>(response);
  },

  // ==========================================
  // PROFILE
  // ==========================================

  /**
   * Buscar perfil detalhado (XP, level, streak, badges)
   * GET /api/profile/
   */
  async getProfile(token: string): Promise<ProfileDetailResponse> {
    const response = await fetchWithTimeout(`${API_URL}/api/profile/`, {
      method: "GET",
      headers: authHeaders(token),
    });
    return handleResponse<ProfileDetailResponse>(response);
  },

  // ==========================================
  // LEARNING PATH
  // ==========================================

  /**
   * Buscar trilha de aprendizado do usuário
   * GET /api/learning-path/
   */
  async getLearningPath(token: string): Promise<LearningPathResponse> {
    const response = await fetchWithTimeout(`${API_URL}/api/learning-path/`, {
      method: "GET",
      headers: authHeaders(token),
    });
    return handleResponse<LearningPathResponse>(response);
  },

  // ==========================================
  // ACTIVITY
  // ==========================================

  /**
   * Buscar histórico de atividades do usuário
   * GET /api/activity/
   */
  async getActivity(token: string): Promise<ActivityLog[]> {
    const response = await fetchWithTimeout(`${API_URL}/api/activity/`, {
      method: "GET",
      headers: authHeaders(token),
    });
    return handleResponse<ActivityLog[]>(response);
  },

  // ==========================================
  // CHALLENGES - FIND ERRORS
  // ==========================================

  /**
   * Iniciar novo exercício de encontrar erros
   * GET /api/challenges/find-errors/start/
   */
  async startFindErrors(token: string, reset: boolean = false, recipeType?: "A" | "B" | "C"): Promise<FindErrorsExercise> {
    const query: string[] = [];
    if (reset) query.push("reset=true");
    if (recipeType) query.push(`recipe_type=${recipeType}`);
    const suffix = query.length ? `?${query.join("&")}` : "";
    const response = await fetchWithTimeout(`${API_URL}/api/challenges/find-errors/start/${suffix}`, {
      method: "POST",
      headers: authHeaders(token),
    });
    return handleResponse<FindErrorsExercise>(response);
  },

  /**
   * Retomar exercício em andamento
   * GET /api/challenges/find-errors/attempt/{attempt_id}/
   */
  async getFindErrorsAttempt(token: string, attemptId: number): Promise<FindErrorsExercise> {
    const response = await fetchWithTimeout(`${API_URL}/api/challenges/find-errors/attempt/${attemptId}/`, {
      method: "GET",
      headers: authHeaders(token),
    });
    return handleResponse<FindErrorsExercise>(response);
  },

  /**
   * Submeter clique em erro
   * POST /api/challenges/find-errors/attempt/{attempt_id}/click/
   */
  async submitFindErrorsClick(
    token: string,
    attemptId: number,
    x: number,
    y: number
  ): Promise<FindErrorsSubmitResponse> {
    const response = await fetchWithTimeout(`${API_URL}/api/challenges/find-errors/attempt/${attemptId}/click/`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ x, y }),
    });
    return handleResponse<FindErrorsSubmitResponse>(response);
  },

  /**
   * Submeter erro por texto (found_error)
   * POST /api/challenges/find-errors/attempt/{attempt_id}/submit/
   */
  async submitFindErrorsError(token: string, attemptId: number, foundError: string): Promise<FindErrorsSubmitResponse> {
    const response = await fetchWithTimeout(`${API_URL}/api/challenges/find-errors/attempt/${attemptId}/submit/`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ found_error: foundError }),
    });
    return handleResponse<FindErrorsSubmitResponse>(response);
  },

  // ==========================================
  // CHALLENGES - SEPARAÇÃO
  // ==========================================

  /**
   * Listar medicamentos disponíveis
   * GET /api/challenges/separacao/
   */
  async getMedications(token: string, count?: number): Promise<Medication[]> {
    const url = count
      ? `${API_URL}/api/challenges/separacao/?count=${count}`
      : `${API_URL}/api/challenges/separacao/`;
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: authHeaders(token),
    });
    return handleResponse<Medication[]>(response);
  },

  /**
   * Iniciar exercício de separação
   * POST /api/challenges/separacao/start/
   */
  async startSeparacao(token: string, reset: boolean = false): Promise<SeparacaoAttempt> {
    const url = `${API_URL}/api/challenges/separacao/start/${reset ? "?reset=true" : ""}`;
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: authHeaders(token),
    });
    return handleResponse<SeparacaoAttempt>(response);
  },

  /**
   * Retomar exercício de separação em andamento
   * GET /api/challenges/separacao/attempt/
   */
  async getSeparacaoAttempt(token: string): Promise<SeparacaoAttempt> {
    const response = await fetchWithTimeout(`${API_URL}/api/challenges/separacao/attempt/`, {
      method: "GET",
      headers: authHeaders(token),
    });
    return handleResponse<SeparacaoAttempt>(response);
  },

  /**
   * Submeter resposta de separação
   * POST /api/challenges/separacao/attempt/{attempt_id}/answer/
   */
  async submitSeparacaoAnswer(
    token: string,
    attemptId: number,
    category: string
  ): Promise<SeparacaoStepResult> {
    const response = await fetchWithTimeout(`${API_URL}/api/challenges/separacao/attempt/${attemptId}/answer/`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ category }),
    });
    return handleResponse<SeparacaoStepResult>(response);
  },

  // ==========================================
  // CHALLENGES - ATENDIMENTO
  // ==========================================

  /**
   * Buscar cenário de atendimento
   * GET /api/challenges/atendimento/
   */
  async getAtendimento(token: string): Promise<AtendimentoExercise> {
    const response = await fetchWithTimeout(`${API_URL}/api/challenges/atendimento/`, {
      method: "GET",
      headers: authHeaders(token),
    });
    return handleResponse<AtendimentoExercise>(response);
  },

  /**
   * Submeter resposta de atendimento
   * POST /api/challenges/atendimento/submit/
   */
  async submitAtendimento(
    token: string,
    challengeId: number,
    responseText: string
  ): Promise<AtendimentoResult> {
    const response = await fetchWithTimeout(`${API_URL}/api/challenges/atendimento/submit/`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        challenge_id: challengeId,
        response_text: responseText,
      }),
    });
    return handleResponse<AtendimentoResult>(response);
  },

  // ==========================================
  // LEADERBOARD
  // ==========================================

  /**
   * Buscar ranking global
   * GET /api/leaderboard/
   */
  async getLeaderboard(token: string): Promise<LeaderboardEntry[]> {
    const response = await fetchWithTimeout(`${API_URL}/api/leaderboard/`, {
      method: "GET",
      headers: authHeaders(token),
    });
    return handleResponse<LeaderboardEntry[]>(response);
  },

  // ==========================================
  // BADGES
  // ==========================================

  /**
   * Listar todas as badges
   * GET /api/badges/
   */
  async getBadges(token: string): Promise<{ badges: Badge[]; earned: Badge[] }> {
    const response = await fetchWithTimeout(`${API_URL}/api/badges/`, {
      method: "GET",
      headers: authHeaders(token),
    });
    return handleResponse<{ badges: Badge[]; earned: Badge[] }>(response);
  },
};

// Export default também para facilitar import
export default apiService;
