import type { PropsWithChildren } from 'react';

/** Native apps retain their own tab bar and draggable player. */
export default function WebAppShell({ children }: PropsWithChildren) {
  return children;
}
