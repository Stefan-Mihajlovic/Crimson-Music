import { Image } from 'expo-image';
import type { CSSProperties } from 'react';
import type { DesktopMusicPreferencesProps } from '@/components/desktop-music-preferences';
import { useAppSettings } from '@/providers/settings-provider';
import { SymbolView } from '@/components/app-symbol';
import { recommendationDetails, recommendationOrder } from '@/services/recommendation-presentation';

export default function DesktopMusicPreferences({
  categories, recommendationOptions, selectedCategories, recommendationStyle,
  onToggleCategory, onSelectRecommendation, onSave, onClose, saving, error, editing,
}: DesktopMusicPreferencesProps) {
  const { colors, isDark, reduceMotion, performanceMode } = useAppSettings();
  const preferredArtwork = categories.filter((category) => selectedCategories.includes(category.id));
  const artwork = preferredArtwork.length ? preferredArtwork : categories.slice(0, 4);
  const spread = recommendationOrder.indexOf(recommendationStyle);
  const buttonStyle: CSSProperties = { borderRadius: 24, minHeight: 44, padding: '0 24px', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer' };
  return (
    <section className="crimson-preferences" data-reduced-motion={reduceMotion || performanceMode || undefined} aria-label="Music preferences" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: colors.background, color: colors.text, fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', colorScheme: isDark ? 'dark' : 'light', '--preference-accent': colors.accent } as CSSProperties}>
      <style>{preferenceMotion}</style>
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
                return <label className="preference-choice" key={category.id} style={{ position: 'relative', height: 108, overflow: 'hidden', borderRadius: 12, cursor: saving ? 'default' : 'pointer', border: `2px solid ${selected ? colors.accent : 'transparent'}`, background: colors.elevated }}>
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
            <div className="preference-discovery-layout">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                {recommendationOptions.map((option) => {
                  const selected = recommendationStyle === option.id;
                  return <label className="preference-choice" key={option.id}
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '18px 16px', minHeight: 86, borderRadius: 20, cursor: saving ? 'default' : 'pointer', border: `1px solid ${selected ? colors.accent : colors.border}`, background: colors.elevated, overflow: 'hidden' }}>
                    <span aria-hidden className="preference-selection" style={{ position: 'absolute', inset: 0, opacity: selected ? 1 : 0, background: `linear-gradient(120deg, ${colors.accentSoft}, transparent)`, pointerEvents: 'none' }} />
                    <input type="radio" name="discovery-style" value={option.id} aria-label={option.label} aria-describedby={`discovery-description-${option.id}`} checked={selected}
                      onChange={() => onSelectRecommendation(option.id)} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
                    <span aria-hidden style={{ position: 'relative', flexShrink: 0 }}><SymbolView name={recommendationDetails[option.id].icon} size={24} tintColor={colors.accent} /></span>
                    <span style={{ position: 'relative', flex: 1 }}><strong style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{option.label}</strong><span id={`discovery-description-${option.id}`} style={{ display: 'block', marginTop: 5, color: colors.secondaryText, fontSize: 12, lineHeight: 1.5 }}>{recommendationDetails[option.id].description}</span></span>
                    <span aria-hidden style={{ position: 'relative', width: 22, height: 22, flexShrink: 0, border: `1px solid ${colors.border}`, borderRadius: '50%' }}>
                      <span className="preference-check" style={{ position: 'absolute', inset: -1, opacity: selected ? 1 : 0, transform: `scale(${selected ? 1 : 0.65})` }}><SymbolView name="checkmark.circle.fill" size={24} tintColor={colors.accent} /></span>
                    </span>
                  </label>;
                })}
              </div>
              <div aria-hidden="true" style={{ position: 'relative', height: 174, pointerEvents: 'none', background: `radial-gradient(ellipse, ${colors.accentSoft}, transparent 70%)` }}>
                {artwork.length ? [0, 1, 2, 3].map((index) => {
                  const distance = index - 1.5;
                  return <div key={index} className="preference-sleeve" style={{ position: 'absolute', width: 66, height: 82, left: '50%', marginLeft: -33, top: 26, overflow: 'hidden', borderRadius: 13, border: '1px solid #FFFFFF30', zIndex: index === 1 ? 4 : index === 2 ? 3 : 1, transform: `translate(${distance * (24 + spread * 9)}px, ${Math.abs(distance) * (8 + spread * 3)}px) rotate(${distance * (8 + spread * 5)}deg)` }}>
                    <Image source={artwork[index % artwork.length].image} contentFit="cover" style={{ position: 'absolute', inset: 0 }} />
                  </div>;
                }) : null}
                <span style={{ position: 'absolute', bottom: 0, width: '100%', textAlign: 'center', color: colors.secondaryText, fontSize: 12 }}>Built around your taste</span>
              </div>
            </div>
          </fieldset>
        </div>
        <footer style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: '20px 40px 28px', borderTop: `1px solid ${colors.border}` }}>
          <p role={error ? 'alert' : undefined} style={{ margin: 0, fontSize: 13, color: error ? '#EF8299' : colors.secondaryText, lineHeight: 1.5 }}>{error || (saving ? 'Saving your preferences…' : 'Your choices shape your Home recommendations.')}</p>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            {onClose ? <button type="button" disabled={saving} onClick={onClose} style={{ ...buttonStyle, border: `1px solid ${colors.border}`, color: colors.text, background: colors.elevated }}>Cancel</button> : null}
            <button type="submit" disabled={saving || selectedCategories.length < 2} style={{ ...buttonStyle, border: 0, background: '#FFFFFF', color: '#100D17', opacity: saving || selectedCategories.length < 2 ? 0.5 : 1 }}>{saving ? 'Saving…' : editing ? 'Save preferences' : 'Start listening'}</button>
          </div>
        </footer>
      </form>
    </section>
  );
}

const preferenceMotion = `
.crimson-preferences .preference-discovery-layout { display: grid; grid-template-columns: minmax(0, 1fr) 230px; gap: 24px; align-items: center; }
.crimson-preferences .preference-choice, .crimson-preferences button { transition: transform 180ms cubic-bezier(.22,1,.36,1), border-color 240ms ease, background-color 240ms ease; }
.crimson-preferences .preference-selection { transition: opacity 240ms ease; }
.crimson-preferences .preference-check { transition: opacity 240ms ease, transform 320ms cubic-bezier(.22,1,.36,1); }
.crimson-preferences .preference-sleeve { transition: transform 420ms cubic-bezier(.22,1,.36,1); }
.crimson-preferences fieldset:not(:disabled) .preference-choice:active, .crimson-preferences button:not(:disabled):active { transform: scale(.985); }
.crimson-preferences .preference-choice:focus-within, .crimson-preferences button:focus-visible { outline: 2px solid var(--preference-accent); outline-offset: 3px; }
.crimson-preferences[data-reduced-motion] *, .crimson-preferences[data-reduced-motion] *:active { transition: none !important; }
.crimson-preferences[data-reduced-motion] .preference-choice:active, .crimson-preferences[data-reduced-motion] button:active { transform: none !important; }
@media (prefers-reduced-motion: reduce) {
  .crimson-preferences * { transition: none !important; }
  .crimson-preferences .preference-choice:active, .crimson-preferences button:active { transform: none !important; }
}
@media (max-width: 1100px) { .crimson-preferences .preference-discovery-layout { grid-template-columns: minmax(0, 1fr); } .crimson-preferences .preference-discovery-layout > [aria-hidden] { display: none; } }
`;
