import { StyleSheet } from 'react-native';

const appTypeScale = 0.84;
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
