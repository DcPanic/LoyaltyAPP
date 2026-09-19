import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearTokens, getAccessToken, saveTokens } from './api';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  businessId: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
  permissions: string[];
  locationIds: string[];
}

export interface SessionBusiness {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  logoUrl: string | null;
  currency: string;
}

interface SessionPayload {
  user: SessionUser;
  business: SessionBusiness;
}

interface SessionContextValue extends Partial<SessionPayload> {
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  can: (permission: string) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setSession(null);
      setLoading(false);
      return;
    }
    try {
      setSession(await api<SessionPayload>('/v1/auth/me'));
    } catch {
      await clearTokens();
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api<SessionPayload & { accessToken: string; refreshToken: string }>(
      '/v1/auth/login',
      { method: 'POST', body: { email, password }, auth: false },
    );
    await saveTokens(result.accessToken, result.refreshToken);
    setSession({ user: result.user, business: result.business });
  }, []);

  const signOut = useCallback(async () => {
    await clearTokens();
    setSession(null);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      ...session,
      loading,
      signIn,
      signOut,
      can: (permission: string) => session?.user.permissions.includes(permission) ?? false,
    }),
    [session, loading, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
