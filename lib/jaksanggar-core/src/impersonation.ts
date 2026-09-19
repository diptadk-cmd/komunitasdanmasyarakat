export interface ImpersonationUserIdentity {
  id: string;
  apiId?: string;
  username: string;
}

export interface ImpersonationUserRef {
  localId: string;
  apiId?: string;
  username?: string;
}

/**
 * `originalUserId` dan `impersonatedUserId` tetap disimpan agar sesi dari
 * versi lama masih dapat dibaca. ID API dan username menjadi identitas stabil
 * saat Konsol dan aplikasi utama dibangun dari snapshot data lokal berbeda.
 */
export interface StoredImpersonationState {
  version?: 2;
  originalUserId: string;
  impersonatedUserId: string;
  originalApiId?: string;
  impersonatedApiId?: string;
  originalUsername?: string;
  impersonatedUsername?: string;
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parseImpersonationState(
  value: unknown,
): StoredImpersonationState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const originalUserId = nonEmpty(candidate.originalUserId);
  const impersonatedUserId = nonEmpty(candidate.impersonatedUserId);
  if (!originalUserId || !impersonatedUserId) return null;

  return {
    version: candidate.version === 2 ? 2 : undefined,
    originalUserId,
    impersonatedUserId,
    originalApiId: nonEmpty(candidate.originalApiId),
    impersonatedApiId: nonEmpty(candidate.impersonatedApiId),
    originalUsername: nonEmpty(candidate.originalUsername),
    impersonatedUsername: nonEmpty(candidate.impersonatedUsername),
  };
}

export function createImpersonationState(
  original: ImpersonationUserIdentity,
  target: ImpersonationUserIdentity,
): StoredImpersonationState {
  return {
    version: 2,
    originalUserId: original.id,
    impersonatedUserId: target.id,
    originalApiId: nonEmpty(original.apiId),
    impersonatedApiId: nonEmpty(target.apiId),
    originalUsername: nonEmpty(original.username),
    impersonatedUsername: nonEmpty(target.username),
  };
}

export function originalImpersonationRef(
  state: StoredImpersonationState,
): ImpersonationUserRef {
  return {
    localId: state.originalUserId,
    apiId: state.originalApiId,
    username: state.originalUsername,
  };
}

export function targetImpersonationRef(
  state: StoredImpersonationState,
): ImpersonationUserRef {
  return {
    localId: state.impersonatedUserId,
    apiId: state.impersonatedApiId,
    username: state.impersonatedUsername,
  };
}

export function resolveImpersonationUser<T extends ImpersonationUserIdentity>(
  users: readonly T[],
  ref: ImpersonationUserRef,
): T | undefined {
  if (ref.apiId) {
    const byApiId = users.find((user) => user.apiId === ref.apiId);
    if (byApiId) return byApiId;
  }
  if (ref.username) {
    const normalized = ref.username.toLocaleLowerCase();
    const byUsername = users.find(
      (user) => user.username.toLocaleLowerCase() === normalized,
    );
    if (byUsername) return byUsername;
  }
  return users.find((user) => user.id === ref.localId);
}
