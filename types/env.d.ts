interface Env {
  [key: string]: string | undefined;
  CORS_ALLOWED_ORIGINS?: string;
  FRONTEND_URL?: string;
  CANONICAL_API_ORIGIN?: string;
  API_ORIGIN?: string;
  API_BASE_URL?: string;
}
