/**
 * Map legacy/host env names onto the names this app reads.
 * Does not overwrite a variable that is already set.
 */
const ALIASES: Record<string, string[]> = {
  CORS_ORIGINS: ['CORS_ORIGINS'],
  DATABASE_HOST: ['DATABASE_HOST'],
  DATABASE_PORT: ['DATABASE_PORT'],
  DATABASE_USER: ['DATABASE_USER'],
  DATABASE_PASSWORD: ['DATABASE_PASSWORD'],
  DATABASE_NAME: ['DATABASE_NAME'],
  DATABASE_CONNECTION_LIMIT: ['DATABASE_CONNECTION_LIMIT'],
  DATABASE_CONNECT_TIMEOUT: ['DATABASE_CONNECT_TIMEOUT'],
  SHADOW_DATABASE_URL: ['SHADOW_DATABASE_URL'],
  REDIS_URL: ['REDIS_URL'],
  SYNC_ENGINE_DRIVER: ['SYNC_ENGINE_DRIVER'],
  ENCRYPTION_KEY_VERSION: ['ENCRYPTION_KEY_VERSION'],
  ENCRYPTION_KEYS: ['ENCRYPTION_KEYS'],
  JWT_ACCESS_SECRET: ['JWT_ACCESS_SECRET'],
  JWT_ACCESS_TTL: ['JWT_ACCESS_TTL'],
  JWT_REFRESH_TTL_DAYS: ['JWT_REFRESH_TTL_DAYS'],
  STORAGE_DRIVER: ['STORAGE_DRIVER'],
  STORAGE_LOCAL_ROOT: ['STORAGE_LOCAL_ROOT'],
  APP_URL: ['APP_URL'],
};

export function applyEnvAliases(): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    if (process.env[canonical]?.trim()) continue;
    const found = aliases
      .map((name) => process.env[name]?.trim())
      .find((value) => value);
    if (found) {
      process.env[canonical] = found;
      mapped[canonical] = found;
    }
  }
  return mapped;
}