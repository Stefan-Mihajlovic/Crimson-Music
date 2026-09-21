import { expect } from '@jest/globals';
import { FlatList, ScrollView, View } from 'react-native';
import PopupSheetLayout from '../../src/components/popup-sheet-layout';

/** Heading belongs to the scroll content, never a separately resized sibling. */
export function assertNativeSheetLayout(root, { header = true, list = false } = {}) {
  const layout = root.findByType(PopupSheetLayout);
  const children = layout.children.filter((child) => typeof child !== 'string');
  expect(children).toHaveLength(1);
  const scroll = children[0];
  expect(scroll.type).toBe(list ? FlatList : ScrollView);
  if (header) {
    const heading = layout.props.header;
    expect(scroll.findAll((node) => node.type === heading.type && node.props.children === heading.props.children)).toHaveLength(1);
  }
  // The native sheet can resize this sole scrolling root at any time; the
  // heading and rows retain the same content coordinate system.
  for (let ancestor = layout.parent; ancestor; ancestor = ancestor.parent) {
    expect(ancestor.type).not.toBe(View);
    expect(ancestor.type).not.toBe(ScrollView);
  }
}
