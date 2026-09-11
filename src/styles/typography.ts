import { StyleSheet } from 'react-native';

const appTypeScale = 0.84;
/** Explicit design sizes for new controls. Existing screens retain their visual scale during migration. */
export const Type = {
  caption: 12,
  supporting: 14,
  body: 16,
  label: 16,
  title: 24,
  display: 32,
} as const;
export const readableLineHeight = (fontSize: number) => Math.round(fontSize * 1.45);
let configured = false;

function scaleMetric(value: unknown) {
  if (typeof value !== 'number') return value;
  return Math.round(value * appTypeScale * 10) / 10;
}

export function configureAppTypography() {
  if (configured) return;
  if (typeof StyleSheet.setStyleAttributePreprocessor !== 'function') return;
  configured = true;
  StyleSheet.setStyleAttributePreprocessor('fontSize', scaleMetric);
  StyleSheet.setStyleAttributePreprocessor('lineHeight', scaleMetric);
}
