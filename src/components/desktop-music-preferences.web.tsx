import { Image } from 'expo-image';
import type { CSSProperties } from 'react';
import type { DesktopMusicPreferencesProps } from '@/components/desktop-music-preferences';
import { useAppSettings } from '@/providers/settings-provider';

const descriptions = {
  familiar: 'More of the sounds you already enjoy.',
  balanced: 'Familiar favorites and fresh discoveries.',
  surprise: 'Explore beyond your usual listening.',
  underground: 'Find emerging artists and lesser-known tracks.',
};

export default function DesktopMusicPreferences({
  categories, recommendationOptions, selectedCategories, recommendationStyle,
  onToggleCategory, onSelectRecommendation, onSave, onClose, saving, error, editing,
}: DesktopMusicPreferencesProps) {
  const { colors, isDark } = useAppSettings();
  const buttonStyle: CSSProperties = { borderRadius: 24, minHeight: 44, padding: '0 24px', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer' };
  return (
    <section aria-label="Music preferences" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: colors.background, color: colors.text, fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', colorScheme: isDark ? 'dark' : 'light' }}>
      <form onSubmit={(event) => { event.preventDefault(); if (!saving && selectedCategories.length >= 2) onSave(); }}
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%', maxWidth: 1040, alignSelf: 'center' }}>
        <div style={{ overflowY: 'auto', minHeight: 0, padding: '36px 40px 24px', flex: 1 }}>
          <h1 style={{ margin: '0 0 10px', fontSize: 32, letterSpacing: '-.8px' }}>{editing ? 'Music preferences' : 'Make Crimson yours'}</h1>
          <p style={{ margin: '0 0 30px', color: colors.secondaryText, fontSize: 14, lineHeight: 1.6 }}>Choose the music you enjoy and how you want to discover more.</p>
          <fieldset disabled={saving} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <legend style={{ fontSize: 19, fontWeight: 700, padding: 0 }}>Your favorite genres</legend>
            <p style={{ margin: '8px 0 16px', color: colors.secondaryText, fontSize: 13 }}>Select at least 2. You can change these anytime.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
              {categories.map((category) => {
                const selected = selectedCategories.includes(category.id);
                return <label key={category.id} style={{ position: 'relative', height: 108, overflow: 'hidden', borderRadius: 12, cursor: saving ? 'default' : 'pointer', border: `2px solid ${selected ? colors.accent : 'transparent'}`, background: colors.elevated }}>
                  <Image source={category.image} contentFit="cover" style={{ position: 'absolute', inset: 0, opacity: selected ? 1 : 0.65 }} />
                  <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent, rgba(0,0,0,.76))', pointerEvents: 'none' }} />
                  <input type="checkbox" aria-label={category.label} checked={selected} onChange={() => onToggleCategory(category.id)}
                    style={{ position: 'absolute', top: 10, right: 10, margin: 0, width: 18, height: 18, accentColor: colors.accent, cursor: 'inherit' }} />
                  <span style={{ position: 'absolute', left: 12, right: 8, bottom: 12, fontSize: 14, color: '#fff', fontWeight: 700 }}>{category.label}</span>
                </label>;
              })}
            </div>
            <p aria-live="polite" style={{ color: colors.secondaryText, fontSize: 12, margin: '12px 0 28px' }}>{selectedCategories.length} selected</p>
          </fieldset>
          <fieldset disabled={saving} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <legend style={{ fontSize: 19, fontWeight: 700, padding: 0, marginBottom: 16 }}>Your discovery style</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {recommendationOptions.map((option) => <label key={option.id}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', minHeight: 74, borderRadius: 12, cursor: saving ? 'default' : 'pointer', border: `1px solid ${recommendationStyle === option.id ? colors.accent : colors.border}`, background: recommendationStyle === option.id ? colors.accentSoft : colors.elevated }}>
                <input type="radio" name="discovery-style" value={option.id} aria-label={option.label} checked={recommendationStyle === option.id}
                  onChange={() => onSelectRecommendation(option.id)} style={{ margin: 0, width: 18, height: 18, flexShrink: 0, accentColor: colors.accent }} />
                <span><strong style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{option.label}</strong><span style={{ display: 'block', marginTop: 5, color: colors.secondaryText, fontSize: 12, lineHeight: 1.5 }}>{descriptions[option.id]}</span></span>
              </label>)}
            </div>
          </fieldset>
        </div>
        <footer style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: '20px 40px 28px', borderTop: `1px solid ${colors.border}` }}>
          <p role={error ? 'alert' : undefined} style={{ margin: 0, fontSize: 13, color: error ? '#EF8299' : colors.secondaryText, lineHeight: 1.5 }}>{error || (saving ? 'Saving your preferences…' : 'Your choices shape your Home recommendations.')}</p>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            {onClose ? <button type="button" disabled={saving} onClick={onClose} style={{ ...buttonStyle, border: `1px solid ${colors.border}`, color: colors.text, background: colors.elevated }}>Cancel</button> : null}
            <button type="submit" disabled={saving || selectedCategories.length < 2} style={{ ...buttonStyle, border: 0, background: colors.accent, color: '#fff', opacity: saving || selectedCategories.length < 2 ? 0.5 : 1 }}>{saving ? 'Saving…' : editing ? 'Save preferences' : 'Start listening'}</button>
          </div>
        </footer>
      </form>
    </section>
  );
}
