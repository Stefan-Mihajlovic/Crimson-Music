import { BrandAccent } from '@/constants/brand-accent';
/** Browser-only chrome; native surfaces keep their platform styles. */
export const webShellStyles = `
html, body, #root { height: 100%; overscroll-behavior: none; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.crimson-shell { position: relative; height: 100dvh; min-height: 0; display: flex; overflow: hidden; background: var(--crimson-bg); color: var(--crimson-text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; box-sizing: border-box; }
.crimson-shell *, .crimson-shell *::before, .crimson-shell *::after { box-sizing: border-box; }
.crimson-shell button { font-family: inherit; cursor: pointer; }
.crimson-shell button:disabled { opacity: .35; cursor: default; }
.crimson-shell :is(button, input, [role=button], [role=tab], a):focus-visible { outline: 2px solid var(--crimson-accent); outline-offset: 3px; }
.crimson-shell input { color: var(--crimson-text); font: inherit; }
.crimson-shell ::selection { background: var(--crimson-active); }
html, body * { scrollbar-width: thin; scrollbar-color: var(--crimson-accent, ${BrandAccent.dark}) transparent; }
::-webkit-scrollbar { width: 7px; height: 7px; }
::-webkit-scrollbar-thumb { background: var(--crimson-accent, ${BrandAccent.dark}); border-radius: 8px; }
::-webkit-scrollbar-track { background: transparent; }
.crimson-shell.is-desktop { padding: 10px; gap: 10px; }
.crimson-sidebar { width: var(--crimson-sidebar-width); flex: 0 0 var(--crimson-sidebar-width); transition: width .3s cubic-bezier(.22,1,.36,1), flex-basis .3s cubic-bezier(.22,1,.36,1); display: flex; flex-direction: column; min-height: 0; background: var(--crimson-panel); border-radius: 14px; overflow: hidden; }
.crimson-brand { height: 66px; flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 12px 18px; border: 0; color: var(--crimson-text); background: transparent; text-align: left; font-size: 19px; font-weight: 750; letter-spacing: -.5px; }
.crimson-brand-title { padding: 0; border: 0; background: transparent; color: inherit; font: inherit; letter-spacing: inherit; text-align: left; }
.crimson-sidebar-toggle { position: relative; display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 10px; background: transparent; flex-shrink: 0; }
.crimson-brand-icon, .crimson-sidebar-toggle-icon { position: absolute; display: grid; place-items: center; inset: 0; transition: opacity .16s; }
.crimson-sidebar-toggle-icon { opacity: 0; }
.crimson-sidebar:hover .crimson-brand-icon, .crimson-sidebar-toggle:focus-visible .crimson-brand-icon { opacity: 0; }
.crimson-sidebar:hover .crimson-sidebar-toggle-icon, .crimson-sidebar-toggle:focus-visible .crimson-sidebar-toggle-icon { opacity: 1; }
.crimson-sidebar-resizer { position: absolute; z-index: 40; left: calc(var(--crimson-sidebar-width) + 10px); width: 10px; top: 14px; bottom: 14px; cursor: col-resize; touch-action: none; transition: left .3s cubic-bezier(.22,1,.36,1); }
.crimson-sidebar-resizer::after { content: ''; position: absolute; width: 2px; top: 8px; bottom: 8px; left: 4px; border-radius: 2px; background: var(--crimson-muted); opacity: 0; transition: opacity .16s; }
.crimson-sidebar-resizer:hover::after, .crimson-sidebar-resizer:focus-visible::after, .is-resizing-sidebar .crimson-sidebar-resizer::after { opacity: 1; }
.is-resizing-sidebar, .is-resizing-sidebar * { cursor: col-resize !important; user-select: none !important; }
.is-resizing-sidebar .crimson-sidebar, .is-resizing-sidebar .crimson-sidebar-resizer, .is-resizing-sidebar .crimson-player-bar { transition: none; }
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
.crimson-icon-button { width: 36px; height: 36px; }
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
.crimson-toolbar { height: 62px; flex: 0 0 62px; display: grid; grid-template-columns: minmax(136px, 1fr) minmax(0, 530px) minmax(136px, 1fr); gap: 20px; align-items: center; padding: 0 8px 10px; }
.crimson-history-buttons { display: flex; gap: 6px; }
.crimson-global-search { justify-self: center; min-width: 0; display: flex; align-items: center; gap: 12px; height: 44px; max-width: 530px; width: min(100%, 530px); padding: 0 16px; border-radius: 24px; background: var(--crimson-panel); border: 1px solid transparent; cursor: text; }
.crimson-global-search:focus-within { border-color: var(--crimson-accent); }
.crimson-shell [data-crimson-search] input { outline: none !important; }
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
.crimson-player-time { flex-shrink: 0; white-space: nowrap; }
@container (max-width: 940px) { .crimson-player-time { display: none; } }
@container (max-width: 780px) { .crimson-player-volume input { display: none; } }
.crimson-dock-timeline { position: absolute; left: 14px; right: 14px; top: -6px; height: 12px; display: flex; align-items: center; }
.crimson-dock-timeline .crimson-player-range::-webkit-slider-thumb { opacity: 0; transition: opacity .15s; }
.crimson-dock-timeline:hover .crimson-player-range::-webkit-slider-thumb, .crimson-dock-timeline:focus-within .crimson-player-range::-webkit-slider-thumb { opacity: 1; }
.crimson-player-range::-moz-range-progress { background: var(--crimson-accent); height: 4px; border-radius: 10px; }
.reduce-motion *, .reduce-motion *::after, .reduce-motion *::before { scroll-behavior: auto !important; transition-duration: 0s !important; }
@media (prefers-reduced-motion: reduce) { .crimson-shell * { scroll-behavior: auto !important; transition-duration: 0s !important; } }
.crimson-brand-title, .crimson-nav-label { white-space: nowrap; }
.crimson-sidebar button > :first-child { flex-shrink: 0; }
.sidebar-collapsed .crimson-brand { padding-inline: 21px; }
.sidebar-collapsed .crimson-brand-title, .sidebar-collapsed .crimson-nav-label,
.sidebar-collapsed .crimson-account > span, .sidebar-collapsed .crimson-account > :last-child,
.sidebar-collapsed .crimson-library-item > span, .sidebar-collapsed .crimson-library-heading,
.sidebar-collapsed .crimson-library-filters, .sidebar-collapsed .crimson-library-search { display: none; }
.sidebar-collapsed .crimson-nav-item { justify-content: center; padding-inline: 0; }
.sidebar-collapsed .crimson-library-item { padding-inline: 8px; }
.sidebar-collapsed .crimson-account { justify-content: center; }
.crimson-library-item { content-visibility: auto; contain-intrinsic-size: auto 59px; }
.crimson-shell :is(.crimson-icon-button, .crimson-small-button, .crimson-library-item, .crimson-account, .crimson-player-button) { transition: background-color .16s ease, transform .18s ease, opacity .16s ease; }
@media (hover: hover) and (pointer: fine) {
  .crimson-shell :is(.crimson-icon-button, .crimson-small-button):hover { transform: translateY(-1px); }
  .crimson-shell [data-crimson-card]:hover { transform: translateY(-4px); }
}
.crimson-shell [data-crimson-card] { transition: transform .22s cubic-bezier(.22,1,.36,1), background-color .18s ease, opacity .18s ease; }
.crimson-shell [data-crimson-card]:active { transform: scale(.97); }
.crimson-global-search { transition: border-color .18s ease, box-shadow .18s ease; }
.crimson-global-search:focus-within { box-shadow: 0 0 0 3px var(--crimson-active); }
.reduce-motion *, .reduce-motion *::before, .reduce-motion *::after { animation: none !important; transition: none !important; }
.reduce-motion [data-crimson-card]:hover, .reduce-motion button:hover { transform: none !important; }
@media (prefers-reduced-motion: reduce) {
  .crimson-shell * { animation: none !important; transition: none !important; }
  .crimson-shell [data-crimson-card]:hover, .crimson-shell button:hover { transform: none !important; }
}
@media (max-width: 959px) { .crimson-shell { width: 100%; } }
`;
