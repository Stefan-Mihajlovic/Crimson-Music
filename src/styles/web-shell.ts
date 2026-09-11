/** Browser-only chrome; native surfaces keep their platform styles. */
export const webShellStyles = `
html, body, #root { height: 100%; overscroll-behavior: none; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.crimson-shell { height: 100dvh; min-height: 0; display: flex; overflow: hidden; background: var(--crimson-bg); color: var(--crimson-text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; box-sizing: border-box; }
.crimson-shell *, .crimson-shell *::before, .crimson-shell *::after { box-sizing: border-box; }
.crimson-shell button { font-family: inherit; cursor: pointer; }
.crimson-shell button:disabled { opacity: .35; cursor: default; }
.crimson-shell :is(button, input, [role=button], [role=tab], a):focus-visible { outline: 2px solid var(--crimson-accent); outline-offset: 3px; }
.crimson-shell input { color: var(--crimson-text); font: inherit; }
.crimson-shell ::selection { background: var(--crimson-active); }
html, body * { scrollbar-width: thin; scrollbar-color: var(--crimson-accent, #A66BFF) transparent; }
::-webkit-scrollbar { width: 7px; height: 7px; }
::-webkit-scrollbar-thumb { background: var(--crimson-accent, #A66BFF); border-radius: 8px; }
::-webkit-scrollbar-track { background: transparent; }
.crimson-shell.is-desktop { padding: 10px; gap: 10px; }
.crimson-sidebar { width: 250px; flex: 0 0 250px; display: flex; flex-direction: column; min-height: 0; background: var(--crimson-panel); border-radius: 14px; overflow: hidden; }
.crimson-brand { height: 66px; flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 12px 18px; border: 0; color: var(--crimson-text); background: transparent; text-align: left; font-size: 19px; font-weight: 750; letter-spacing: -.5px; }
.crimson-brand-light { font-weight: 500; }
.crimson-primary-nav { padding: 4px 10px 16px; display: flex; flex-direction: column; gap: 3px; }
.crimson-nav-item { border: 0; display: flex; align-items: center; gap: 14px; padding: 11px 14px; min-height: 44px; text-align: left; font-size: 14px; font-weight: 650; background: transparent; color: var(--crimson-muted); border-radius: 9px; transition: background .15s, color .15s; }
.crimson-nav-item.is-active { background: var(--crimson-active); color: var(--crimson-text); }
.crimson-nav-item:hover, .crimson-account:hover, .crimson-library-item:hover { background: var(--crimson-hover); color: var(--crimson-text); }
.crimson-library-panel { min-height: 0; display: flex; flex: 1; flex-direction: column; border-top: 1px solid var(--crimson-border); padding-top: 12px; }
.crimson-library-heading { display: flex; justify-content: space-between; align-items: center; padding: 0 14px 10px 20px; font-size: 13px; font-weight: 700; color: var(--crimson-muted); }
.crimson-library-heading > div { display: flex; gap: 2px; }
.crimson-small-button, .crimson-icon-button { display: inline-flex; justify-content: center; align-items: center; flex-shrink: 0; border: 0; background: transparent; color: var(--crimson-text); width: 30px; height: 30px; border-radius: 50%; }
.crimson-small-button:hover, .crimson-icon-button:hover, .crimson-player-button:hover { background: var(--crimson-hover) !important; }
.crimson-player-button.is-prominent:hover { background: #fff !important; transform: scale(1.04); }
.crimson-icon-button { width: 36px; height: 36px; background: var(--crimson-panel); }
.crimson-library-filters { display: flex; gap: 6px; padding: 0 14px 12px; }
.crimson-library-filters button { border: 0; padding: 7px 12px; border-radius: 20px; font-size: 12px; color: var(--crimson-muted); background: var(--crimson-surface); }
.crimson-library-filters button.is-active { color: var(--crimson-text); background: var(--crimson-active); }
.crimson-library-search { margin: 0 14px 10px; width: calc(100% - 28px); border: 1px solid var(--crimson-border); border-radius: 7px; padding: 9px; background: var(--crimson-bg); font-size: 12px !important; }
.crimson-library-items { overflow: auto; flex: 1; min-height: 0; padding: 0 8px 12px; }
.crimson-library-item { border: 0; display: flex; align-items: center; gap: 11px; padding: 8px; width: 100%; text-align: left; border-radius: 9px; background: transparent; color: var(--crimson-text); }
.crimson-library-item > span, .crimson-account > span { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 5px; }
.crimson-library-item strong, .crimson-account strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; line-height: 1.3; }
.crimson-library-item small, .crimson-account small { color: var(--crimson-muted); font-size: 11px; }
.crimson-library-empty { color: var(--crimson-muted); font-size: 12px; padding: 10px; line-height: 1.6; }
.crimson-library-retry { border: 0; background: transparent; color: var(--crimson-accent); text-align: left; font-size: 12px; padding: 10px; }
.crimson-account { display: flex; align-items: center; gap: 10px; width: calc(100% - 16px); margin: 8px; min-height: 60px; border: 0; border-radius: 10px; padding: 10px; background: transparent; color: var(--crimson-text); text-align: left; }
.crimson-workspace { display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0; }
.crimson-toolbar { height: 62px; flex: 0 0 62px; display: flex; gap: 20px; align-items: center; padding: 0 8px 10px; }
.crimson-history-buttons { display: flex; gap: 6px; }
.crimson-global-search { display: flex; align-items: center; gap: 12px; height: 44px; max-width: 530px; width: min(100%, 530px); padding: 0 16px; border-radius: 24px; background: var(--crimson-panel); border: 1px solid transparent; cursor: text; }
.crimson-global-search:focus-within { border-color: var(--crimson-accent); }
.crimson-global-search input { background: transparent; border: 0; outline: none !important; flex: 1; min-width: 0; height: 100%; font-size: 13px; }
.crimson-global-search input::placeholder { color: var(--crimson-muted); }
.crimson-global-search > button { border: 0; background: transparent; display: flex; padding: 4px; border-radius: 4px; }
.crimson-global-search kbd { font: 10px inherit; white-space: nowrap; color: var(--crimson-muted); border: 1px solid var(--crimson-border); border-radius: 5px; padding: 3px 5px; }
.crimson-toolbar-actions { display: flex; align-items: center; gap: 10px; margin-left: auto; }
.crimson-main-content { display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0; overflow: hidden; position: relative; isolation: isolate; }
.crimson-main-content > div { flex: 1; min-height: 0; min-width: 0; }
.is-desktop .crimson-main-content { border-radius: 13px; background: var(--crimson-panel); }
.is-mobile .crimson-workspace { width: 100%; }
.crimson-player-range { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 10px; cursor: pointer; background: var(--crimson-border); }
.crimson-player-range::-webkit-slider-thumb { -webkit-appearance: none; width: 11px; height: 11px; border-radius: 50%; background: var(--crimson-accent); }
.crimson-player-range::-moz-range-thumb { width: 11px; height: 11px; border: 0; border-radius: 50%; background: var(--crimson-accent); }
.crimson-player-range::-moz-range-progress { background: var(--crimson-accent); height: 4px; border-radius: 10px; }
.reduce-motion *, .reduce-motion *::after, .reduce-motion *::before { scroll-behavior: auto !important; transition-duration: 0s !important; }
@media (prefers-reduced-motion: reduce) { .crimson-shell * { scroll-behavior: auto !important; transition-duration: 0s !important; } }
@media (min-width: 1600px) { .crimson-sidebar { width: 250px; flex-basis: 250px; } }
@media (max-width: 959px) { .crimson-shell { width: 100%; } }
`;
