import type { Alert as NativeAlert, AlertButton, AlertOptions } from 'react-native';

type Notice = { title: string; message?: string; buttons: AlertButton[]; options?: AlertOptions };
const pending: Notice[] = [];

function present() {
  const notice = pending[0];
  if (!notice) return;
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'crimson-alert-title');
  dialog.setAttribute('aria-describedby', 'crimson-alert-message');
  dialog.style.cssText = 'color-scheme:light dark;max-width:min(420px,calc(100vw - 48px));padding:24px;border:0;border-radius:24px;font:16px system-ui;box-shadow:0 20px 80px #0006';
  const title = document.createElement('h2');
  title.id = 'crimson-alert-title';
  title.textContent = notice.title;
  title.style.cssText = 'margin:0 0 12px;font-size:22px';
  const message = document.createElement('p');
  message.id = 'crimson-alert-message';
  message.textContent = notice.message || '';
  message.style.cssText = 'line-height:1.5;white-space:pre-wrap;margin:0 0 24px';
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap';
  let settled = false;
  const finish = (action?: () => void) => {
    if (settled) return;
    settled = true;
    dialog.close();
    dialog.remove();
    pending.shift();
    try { action?.(); } finally { if (pending.length && !document.getElementById('crimson-alert-title')) present(); }
  };
  notice.buttons.forEach((button) => {
    const control = document.createElement('button');
    control.textContent = button.text || 'OK';
    control.style.cssText = `font:inherit;font-weight:600;border:0;border-radius:999px;min-height:44px;padding:10px 18px;cursor:pointer;background:${button.style === 'cancel' ? '#eee' : button.style === 'destructive' ? '#b5233c' : '#7850d4'};color:${button.style === 'cancel' ? '#222' : '#fff'}`;
    control.onclick = () => finish(button.onPress);
    actions.append(control);
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (notice.options?.cancelable) finish(notice.options.onDismiss);
  });
  dialog.append(title, message, actions);
  document.body.append(dialog);
  dialog.showModal();
}

/** React Native Web's Alert is a no-op. Keep every action and cancellation explicit. */
export const Alert: Pick<typeof NativeAlert, 'alert'> = {
  alert(title, message, buttons, options) {
    if (typeof document === 'undefined') return;
    pending.push({ title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }], options });
    if (pending.length === 1) present();
  },
};
