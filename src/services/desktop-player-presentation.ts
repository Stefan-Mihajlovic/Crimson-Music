// The dock stays visible while a lazy desktop player route is loading.
let presented = false;
const listeners = new Set<() => void>();
export const getDesktopPlayerPresented = () => presented;
export const getServerDesktopPlayerPresented = () => false;
export function subscribeDesktopPlayerPresented(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setDesktopPlayerPresented(next: boolean) {
  if (presented === next) return;
  presented = next;
  listeners.forEach((listener) => listener());
}
