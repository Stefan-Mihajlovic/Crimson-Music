import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { reportError } from '@/services/telemetry';
import { clearDeletedAccountData } from '@/services/account-cleanup';

import {
  completeUserOnboarding,
  CrimsonUser,
  hasCompletePersonalization,
  RecommendationStyle,
  refreshSession,
  restoreSession,
  signInWithAudius as authenticateWithAudius,
  signOut as clearAuthSession,
  subscribeAuthSession,
  updateUserRecommendationStyle,
  updateUserTheme,
} from '@/services/auth';

type AuthContextValue = {
  ready: boolean;
  onboardingComplete: boolean;
  user: CrimsonUser | null;
  completeOnboarding: (categories: string[], style: RecommendationStyle) => Promise<CrimsonUser>;
  disconnectAndClearLocalData: () => Promise<void>;
  signInWithAudius: () => Promise<CrimsonUser>;
  signOut: () => Promise<void>;
  updateRecommendationStyle: (style: RecommendationStyle) => Promise<CrimsonUser>;
  updateTheme: (theme: string) => Promise<CrimsonUser>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [user, setUser] = useState<CrimsonUser | null>(null);
  const sessionRevision = useRef(0);
  const applyUser = useCallback((nextUser: CrimsonUser | null, revision: number) => {
    if (revision !== sessionRevision.current) return;
    setUser(nextUser);
    setOnboardingComplete(hasCompletePersonalization(nextUser));
  }, []);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeAuthSession((nextUser) => {
      if (mounted) applyUser(nextUser, ++sessionRevision.current);
    });
    const revision = sessionRevision.current;
    restoreSession()
      .then((restoredUser) => {
        if (mounted && revision === sessionRevision.current) {
          applyUser(restoredUser, revision);
          if (restoredUser) {
            void refreshSession()
              .then((refreshedUser) => {
                if (!mounted || !refreshedUser) return;
                applyUser(refreshedUser, revision);
              })
              .catch(() => undefined);
          }
        }
      })
      .catch((error) => reportError(error, 'auth.restore'))
      .finally(() => {
        if (mounted) {
          setReady(true);
        }
      });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [applyUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      onboardingComplete,
      user,
      completeOnboarding: async (categories, style) => {
        if (!user) throw new Error('Sign in before personalizing Crimson.');
        const revision = sessionRevision.current;
        const nextUser = await completeUserOnboarding(user.uid, categories, style);
        applyUser(nextUser, revision);
        return nextUser;
      },
      disconnectAndClearLocalData: async () => {
        if (!user) throw new Error('Log in before clearing this device’s account data.');
        const revision = ++sessionRevision.current;
        try {
          await clearDeletedAccountData(user.uid);
        } finally {
          try {
            await clearAuthSession();
          } finally {
            applyUser(null, revision);
          }
        }
      },
      signInWithAudius: async () => {
        const revision = ++sessionRevision.current;
        const nextUser = await authenticateWithAudius();
        applyUser(nextUser, revision);
        return nextUser;
      },
      signOut: async () => {
        const revision = ++sessionRevision.current;
        await clearAuthSession();
        applyUser(null, revision);
      },
      updateRecommendationStyle: async (style) => {
        if (!user) throw new Error('Sign in before changing your recommendation style.');
        const revision = sessionRevision.current;
        const nextUser = await updateUserRecommendationStyle(user.uid, style);
        applyUser(nextUser, revision);
        return nextUser;
      },
      updateTheme: async (theme) => {
        if (!user) throw new Error('Sign in before changing your theme.');
        const revision = sessionRevision.current;
        const nextUser = await updateUserTheme(user.uid, theme);
        applyUser(nextUser, revision);
        return nextUser;
      },
    }),
    [applyUser, onboardingComplete, ready, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
