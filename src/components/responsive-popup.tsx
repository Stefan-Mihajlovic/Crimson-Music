import type { ReactNode } from 'react';

import { ModalFrostedSurface } from '@/components/modal-backdrop';
import type { ActionSheetAnchor } from '@/services/action-sheet';

export type ResponsivePopupProps = {
  children: ReactNode;
  onDismiss: () => void;
  label: string;
  anchor?: ActionSheetAnchor | null;
  width?: number;
  expanded?: boolean;
};

/** Native stacks already provide the platform sheet's shape and dismissal. */
export default function ResponsivePopup({ children }: ResponsivePopupProps) {
  return <ModalFrostedSurface>{children}</ModalFrostedSurface>;
}
