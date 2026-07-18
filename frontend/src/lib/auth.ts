const AUTH_STORAGE_KEY = "blog-system-auth";
const API_PREFIX = "/api";

export type AuthUser = {
  id: number;
  username: string;
  nickname: string;
  email: string;
  avatar_url: string;
  bio: string;
  role: number;
  status: number;
  last_login_at: string;
};

export type AuthSession = {
  token_type: string;
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_at: string;
  user: AuthUser;
};

export type StoredAuthSession = AuthSession & {
  rememberMe: boolean;
  storedAt: string;
  storage: "localStorage" | "sessionStorage";
};

export type LoginPayload = {
  account: string;
  password: string;
};

export type RegisterPayload = {
  username: string;
  nickname?: string;
  email: string;
  password: string;
};

export type UpdateProfilePayload = Partial<
  Pick<AuthUser, "username" | "nickname" | "email" | "bio">
>;

export type AvatarUploadResponse = {
  avatar_url: string;
  user: AuthUser;
};

type ApiEnvelope<T> = {
  code: number;
  message: string;
  data?: T;
};

export class ApiError extends Error {
  status: number;
  code?: number;

  constructor(message: string, status: number, code?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStoredAuthSession(value: unknown): value is StoredAuthSession {
  return (
    isRecord(value) &&
    typeof value.rememberMe === "boolean" &&
    typeof value.storedAt === "string" &&
    (value.storage === "localStorage" || value.storage === "sessionStorage") &&
    isAuthSession(value)
  );
}

function isAuthUser(value: unknown): value is AuthUser {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.username === "string" &&
    typeof value.nickname === "string" &&
    typeof value.email === "string" &&
    typeof value.avatar_url === "string" &&
    typeof value.bio === "string" &&
    typeof value.role === "number" &&
    typeof value.status === "number" &&
    typeof value.last_login_at === "string"
  );
}

function isAuthSession(value: unknown): value is AuthSession {
  return (
    isRecord(value) &&
    typeof value.token_type === "string" &&
    typeof value.access_token === "string" &&
    typeof value.expires_in === "number" &&
    typeof value.refresh_token === "string" &&
    typeof value.refresh_expires_at === "string" &&
    isAuthUser(value.user)
  );
}

function isAvatarUploadResponse(value: unknown): value is AvatarUploadResponse {
  return (
    isRecord(value) &&
    typeof value.avatar_url === "string" &&
    isAuthUser(value.user)
  );
}

function readStoredSession(storage: Storage): StoredAuthSession | null {
  const raw = storage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isStoredAuthSession(parsed)) {
      return parsed as StoredAuthSession;
    }
  } catch {
    storage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }

  storage.removeItem(AUTH_STORAGE_KEY);
  return null;
}

async function requestApi<T>(
  path: string,
  init: RequestInit,
  validateData: (value: unknown) => value is T
) {
  const response = await fetch(`${API_PREFIX}${path}`, {
    ...init,
  });

  const responseText = await response.text();
  let envelope: ApiEnvelope<unknown> | null = null;

  if (responseText.trim().length > 0) {
    try {
      envelope = JSON.parse(responseText) as ApiEnvelope<unknown>;
    } catch {
      throw new ApiError("invalid response format", response.status);
    }
  }

  if (
    !envelope ||
    typeof envelope.code !== "number" ||
    typeof envelope.message !== "string"
  ) {
    throw new ApiError("invalid response format", response.status);
  }

  if (!response.ok || envelope.code !== 0) {
    throw new ApiError(envelope.message || "request failed", response.status, envelope.code);
  }

  if (!validateData(envelope.data)) {
    throw new ApiError("missing or invalid response data", response.status, envelope.code);
  }

  return envelope.data;
}

async function requestAuth(path: "/auth/login" | "/auth/register", body: unknown) {
  return requestApi<AuthSession>(
    path,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    },
    isAuthSession
  );
}

export async function login(payload: LoginPayload) {
  return requestAuth("/auth/login", payload);
}

export async function register(payload: RegisterPayload) {
  return requestAuth("/auth/register", payload);
}

export async function getCurrentUser() {
  return requestApi<AuthUser>(
    "/users/me",
    {
      method: "GET",
      headers: buildAuthHeaders({
        Accept: "application/json",
      }),
    },
    isAuthUser
  );
}

export async function updateCurrentUser(payload: UpdateProfilePayload) {
  return requestApi<AuthUser>(
    "/users/me",
    {
      method: "PUT",
      headers: buildAuthHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
      body: JSON.stringify(payload),
    },
    isAuthUser
  );
}

export async function uploadAvatar(file: File) {
  const body = new FormData();
  body.append("avatar", file);

  return requestApi<AvatarUploadResponse>(
    "/users/me/avatar",
    {
      method: "POST",
      headers: buildAuthHeaders({
        Accept: "application/json",
      }),
      body,
    },
    isAvatarUploadResponse
  );
}

function getSessionStorage(storage: StoredAuthSession["storage"]) {
  return storage === "localStorage" ? window.localStorage : window.sessionStorage;
}

function persistStoredAuthSession(storedSession: StoredAuthSession) {
  clearStoredAuthSession();
  getSessionStorage(storedSession.storage).setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify(storedSession)
  );
}

export function storeAuthSession(
  session: AuthSession,
  rememberMe: boolean
): StoredAuthSession {
  const storage: StoredAuthSession["storage"] = rememberMe
    ? "localStorage"
    : "sessionStorage";
  const storedSession: StoredAuthSession = {
    ...session,
    rememberMe,
    storage,
    storedAt: new Date().toISOString(),
  };

  persistStoredAuthSession(storedSession);

  return storedSession;
}

export function updateStoredAuthUser(user: AuthUser): StoredAuthSession | null {
  const currentSession = loadStoredAuthSession();
  if (!currentSession) {
    return null;
  }

  const nextSession = {
    ...currentSession,
    user,
  };

  persistStoredAuthSession(nextSession);
  return nextSession;
}

export function loadStoredAuthSession(): StoredAuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    readStoredSession(window.localStorage) ?? readStoredSession(window.sessionStorage)
  );
}

export function clearStoredAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getStoredAccessToken() {
  return loadStoredAuthSession()?.access_token ?? null;
}

export function buildAuthHeaders(
  init: HeadersInit = {}
): HeadersInit {
  const headers = new Headers(init);
  const token = getStoredAccessToken();
  if (!token) {
    return headers;
  }

  headers.set("Authorization", `Bearer ${token}`);
  return headers;
}
