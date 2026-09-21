import React from 'react';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { act, create } from 'react-test-renderer';
import PersonalMixCover, { PersonalMixArtwork } from '../src/components/personal-mix-cover';
import { resolvePersonalMixArtwork } from '../src/services/personal-mix-artwork';
import { mixArtworkStyles } from '../src/services/personal-mix-artwork-layout';

jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', ClipPath: 'ClipPath', Defs: 'Defs', G: 'G', Image: 'SvgImage', LinearGradient: 'Gradient', Path: 'Path', Rect: 'Rect', Stop: 'Stop', Text: 'SvgText' }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ dataSaver: false }) }));
jest.mock('../src/services/personal-mix-artwork', () => ({ resolvePersonalMixArtwork: jest.fn(async () => []) }));
let root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = undefined; });

test('all six mix card titles have the same type size and detail artwork has no title', async () => {
  await act(async () => { root = create(<>{Object.keys(mixArtworkStyles).map((id) => <PersonalMixArtwork key={id} id={id} images={['data:image/png;base64,photo']} />)}</>); });
  const titles = root.root.findAllByType('SvgText');
  expect(titles).toHaveLength(11);
  expect(new Set(titles.map((title) => title.props.fontSize)).size).toBe(1);
  await act(async () => root.update(<PersonalMixArtwork id="daily" images={['data:image/png;base64,photo']} showTitle={false} />));
  expect(root.root.findAllByType('SvgText')).toHaveLength(0);
  expect(root.root.findByType('SvgImage').props.href).toEqual({ uri: 'data:image/png;base64,photo' });
});

test('live cover waits for decoded artwork and passes the same resolved photo into its mask', async () => {
  let finish;
  resolvePersonalMixArtwork.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const songs = [{ id: 'one', image: 'https://artwork/1000', imageSmall: 'https://artwork/150' }];
  await act(async () => { root = create(<PersonalMixCover id="daily" songs={songs} size={390} showTitle={false} />); });
  expect(root.root.findAllByType('SvgImage')).toHaveLength(0);
  expect(resolvePersonalMixArtwork).toHaveBeenCalledWith(songs, 1, false);
  await act(async () => finish(['data:image/jpeg;base64,resolved']));
  expect(root.root.findByType('SvgImage').props.href).toEqual({ uri: 'data:image/jpeg;base64,resolved' });
  expect(root.root.findAllByType('SvgText')).toHaveLength(0);
});

test('a late image from an old edition cannot replace the current edition artwork', async () => {
  let oldReady;
  resolvePersonalMixArtwork.mockReturnValueOnce(new Promise((resolve) => { oldReady = resolve; })).mockResolvedValueOnce(['data:image/jpeg;base64,new']);
  await act(async () => { root = create(<PersonalMixCover id="daily" songs={[{ image: 'https://old' }]} />); });
  await act(async () => root.update(<PersonalMixCover id="daily" songs={[{ image: 'https://new' }]} />));
  await act(async () => oldReady(['data:image/jpeg;base64,old']));
  expect(root.root.findByType('SvgImage').props.href).toEqual({ uri: 'data:image/jpeg;base64,new' });
});
