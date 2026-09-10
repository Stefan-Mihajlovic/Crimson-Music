import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { setDataSaverEnabled } from '@/services/data-usage';

export type AppThemeMode = 'Light' | 'Dark' | 'Auto';

type AppSettings = {
  theme: AppThemeMode;
  dataSaver: boolean;
  reduceMotion: boolean;
  performanceMode: boolean;
};

export type ResolvedAppTheme = 'Light' | 'Dark';

export type AppPalette = {
  background: string;
  elevated: string;
  controlSurface: string;
  surface: string;
  surfaceStrong: string;
  text: string;
  secondaryText: string;
  mutedText: string;
  border: string;
  accent: string;
  accentSoft: string;
};

const palettes: Record<ResolvedAppTheme, AppPalette> = {
  Light: {
    background: '#FFFFFF',
    elevated: '#F8F6FA',
    controlSurface: 'rgba(248,246,250,0.78)',
    surface: '#F1EEF4',
    surfaceStrong: '#E8E3EC',
    text: '#17131A',
    secondaryText: '#655E6B',
    mutedText: '#817A86',
    border: 'rgba(42,31,48,0.12)',
    accent: '#7D3FD1',
    accentSoft: 'rgba(125,63,209,0.13)',
  },
  Dark: {
    background: '#0E0D13',
    elevated: '#17141C',
    controlSurface: 'rgba(23,20,28,0.68)',
    surface: '#211B29',
    surfaceStrong: '#30283A',
    text: '#F3EEFF',
    secondaryText: '#A29AAA',
    mutedText: '#817A8D',
    border: 'rgba(220,214,247,0.16)',
    accent: '#9B68FA',
    accentSoft: 'rgba(143,89,245,0.18)',
  },
};

type SettingsContextValue = AppSettings & {
  colors: AppPalette;
  isDark: boolean;
  resolvedTheme: ResolvedAppTheme;
  requestedReduceMotion: boolean;
  systemReduceMotion: boolean;
  settingsError: string | null;
  retrySaveSettings: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
};

const STORAGE_KEY = 'crimson.settings.v1';
const defaults: AppSettings = {
  theme: 'Auto',
  dataSaver: false,
  reduceMotion: false,
  performanceMode: false,
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useColorScheme();
  const [settings, setSettings] = useState<AppSettings>(defaults);
  const [ready, setReady] = useState(false);
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  const persistence = useRef<Promise<void>>(Promise.resolve());
  const saveRevision = useRef(0);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setSystemReduceMotion(enabled);
    }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  const saveSettings = useCallback((next: AppSettings) => {
    const revision = ++saveRevision.current;
    persistence.current = persistence.current.catch(() => undefined).then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)));
    void persistence.current.then(() => {
      if (revision === saveRevision.current) setSettingsError(null);
    }).catch(() => {
      if (revision === saveRevision.current) setSettingsError('Settings changed for this session, but could not be saved on this device.');
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    if (typeof patch.dataSaver === 'boolean') setDataSaverEnabled(patch.dataSaver);
    setSettings(next);
    saveSettings(next);
  }, [saveSettings]);

  useEffect(() => {
    let active = true;
    setDataSaverEnabled(defaults.dataSaver);
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!active || !stored) return;
      try {
        const parsed = JSON.parse(stored) as Partial<AppSettings> | null;
        const restored = {
          theme: parsed?.theme === 'Light' || parsed?.theme === 'Dark' ? parsed.theme : 'Auto' as const,
          dataSaver: parsed?.dataSaver === true,
          reduceMotion: parsed?.reduceMotion === true,
          performanceMode: parsed?.performanceMode === true,
        };
        setDataSaverEnabled(restored.dataSaver);
        settingsRef.current = restored;
        setSettings(restored);
      } catch {
        // Ignore invalid settings left by an older build.
      }
    }).catch(() => {
      // Storage can be unavailable; use defaults and allow the app to open.
    }).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, []);

  const resolvedTheme: ResolvedAppTheme = settings.theme === 'Auto'
    ? systemColorScheme === 'light' ? 'Light' : 'Dark'
    : settings.theme;

  const value = useMemo<SettingsContextValue>(() => ({
    ...settings,
    reduceMotion: settings.reduceMotion || systemReduceMotion,
    requestedReduceMotion: settings.reduceMotion,
    systemReduceMotion,
    settingsError,
    retrySaveSettings: () => saveSettings(settingsRef.current),
    colors: palettes[resolvedTheme],
    isDark: resolvedTheme === 'Dark',
    resolvedTheme,
    updateSettings,
  }), [resolvedTheme, settings, systemReduceMotion, settingsError, saveSettings, updateSettings]);

  return <SettingsContext.Provider value={value}>{ready ? children : null}</SettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useAppSettings must be used inside SettingsProvider');
  return context;
}
