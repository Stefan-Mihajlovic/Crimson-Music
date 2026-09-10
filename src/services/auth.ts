import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateAccount, isAccountDeleted, registerAccountCleanup } from '@/services/account-lifecycle';
import { clearAudiusCaches } from '@/services/audius';
import { AudiusSessionError, getAudiusSession, loginAudius, logoutAudius, refreshAudiusAccount, restoreAudiusSession, subscribeAudiusSession } from '@/services/audius-session';
import type { AudiusAccount } from '@/services/audius-session-core';

export type RecommendationStyle = 'familiar' | 'balanced' | 'surprise' | 'underground';
export type CrimsonUser = {
  uid: string;
  Username: string;
  DisplayName?: string;
  Email: string;
  ProfilePhoto?: string;
  AuthProvider: 'audius';
  CanWrite: boolean;
  FavoriteCategories: string[];
  OnboardingComplete: boolean;
  RecommendationStyle?: RecommendationStyle;
};
export class CrimsonAuthError extends Error {
  code: string;
  constructor(message: string, code = 'general') { super(message); this.name = 'CrimsonAuthError'; this.code = code; }
}

type Preferences = { FavoriteCategories?: string[]; RecommendationStyle?: RecommendationStyle };
const preferencesKey = (uid: string) => `crimson.audius.preferences.v1:${uid}`;
const styles: RecommendationStyle[] = ['familiar', 'balanced', 'surprise', 'underground'];
async function userFrom(account: AudiusAccount): Promise<CrimsonUser> {
  let preferences: Preferences = {};
  try {
    const parsed: unknown = JSON.parse(await AsyncStorage.getItem(preferencesKey(account.id)) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) preferences = parsed as Preferences;
  } catch { /* Use device defaults. */ }
  return {
    uid: account.id, Username: account.handle, DisplayName: account.name, Email: '', ProfilePhoto: account.picture,
    AuthProvider: 'audius', CanWrite: getAudiusSession()?.scope === 'write',
    FavoriteCategories: Array.isArray(preferences.FavoriteCategories) ? preferences.FavoriteCategories.filter((v) => typeof v === 'string').slice(0, 10) : [],
    RecommendationStyle: styles.includes(preferences.RecommendationStyle!) ? preferences.RecommendationStyle : 'balanced',
    OnboardingComplete: true,
  };
}
export const hasCompletePersonalization = (user: CrimsonUser | null | undefined) => Boolean(user);
export async function signInWithAudius() {
  try {
    const account = await loginAudius();
    activateAccount(account.id);
    clearAudiusCaches();
    return await userFrom(account);
  } catch (error) {
    if (error instanceof AudiusSessionError) throw new CrimsonAuthError(error.message, error.code);
    throw new CrimsonAuthError('Could not connect to Audius. Check your connection and try again.');
  }
}
export async function restoreSession() {
  const session = await restoreAudiusSession();
  if (!session) return null;
  activateAccount(session.account.id);
  return userFrom(session.account);
}
export async function refreshSession() {
  if (!getAudiusSession()) return null;
  return userFrom(await refreshAudiusAccount());
}
export async function signOut() {
  clearAudiusCaches();
  await logoutAudius();
}
export function subscribeAuthSession(listener: (user: CrimsonUser | null) => void) {
  return subscribeAudiusSession(() => {
    if (!getAudiusSession()) { clearAudiusCaches(); listener(null); }
  });
}
const preferenceWrites = new Map<string, Promise<CrimsonUser>>();
registerAccountCleanup(async (uid) => { await preferenceWrites.get(uid)?.catch(() => undefined); });
function updatePreferences(uid: string, patch: Preferences): Promise<CrimsonUser> {
  const previous = preferenceWrites.get(uid);
  const operation = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(async () => {
    const session = getAudiusSession();
    if (session?.account.id !== uid || isAccountDeleted(uid)) throw new CrimsonAuthError('Login with Audius to continue.');
    const current = await userFrom(session.account);
    await AsyncStorage.setItem(preferencesKey(uid), JSON.stringify({
      FavoriteCategories: current.FavoriteCategories,
      RecommendationStyle: current.RecommendationStyle,
      ...patch,
    }));
    if (getAudiusSession()?.account.id !== uid) throw new CrimsonAuthError('The Audius account changed. Please try again.');
    return userFrom(getAudiusSession()!.account);
  });
  preferenceWrites.set(uid, operation);
  void operation.finally(() => { if (preferenceWrites.get(uid) === operation) preferenceWrites.delete(uid); }).catch(() => undefined);
  return operation;
}
export const updateUserRecommendationStyle = (uid: string, style: RecommendationStyle) => updatePreferences(uid, { RecommendationStyle: styles.includes(style) ? style : 'balanced' });
export const completeUserOnboarding = (uid: string, categories: string[], style: RecommendationStyle) => updatePreferences(uid, { FavoriteCategories: [...new Set(categories.map((v) => v.trim()).filter(Boolean))].slice(0, 10), RecommendationStyle: styles.includes(style) ? style : 'balanced' });
