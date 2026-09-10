import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PersistentOutbox } from '../src/services/persistent-outbox.ts';

function fixture(send, canSend = () => true, discard) {
  const disk = new Map();
  const storage = {
    getItem: async (key) => disk.get(key) ?? null,
    setItem: async (key, value) => { disk.set(key, value); },
  };
  const queue = new PersistentOutbox('events', storage, send, canSend, discard);
  return { queue, items: () => JSON.parse(disk.get('events') || '[]'), storage };
}

test('concurrent enqueues persist once and a restart recovers offline events', async () => {
  const sent = [];
  const { queue, storage, items } = fixture(async () => {}, () => false);
  await Promise.all([{ id: 'a' }, { id: 'b' }, { id: 'a' }].map((event) => queue.enqueue(event)));
  await queue.flush();
  assert.deepEqual(items().map((item) => item.id), ['a', 'b']);
  const restarted = new PersistentOutbox('events', storage, async (event) => { sent.push(event.id); }, () => true);
  await restarted.flush();
  assert.deepEqual(sent, ['a', 'b']);
  assert.deepEqual(items(), []);
});

test('events enqueued during a flush are not lost and concurrent flushes share work', async () => {
  let finish;
  const sent = [];
  const { queue, items } = fixture(async (item) => {
    sent.push(item.id);
    if (item.id === 'a') await new Promise((resolve) => { finish = resolve; });
  });
  await queue.enqueue({ id: 'a' });
  const first = queue.flush();
  assert.equal(first, queue.flush());
  while (!finish) await new Promise((resolve) => setImmediate(resolve));
  await queue.enqueue({ id: 'b' });
  finish();
  await first;
  assert.deepEqual(sent, ['a', 'b']);
  assert.deepEqual(items(), []);
});

test('transient errors retain an event for idempotent retry', async () => {
  let fail = true;
  const { queue, items } = fixture(async () => { if (fail) throw new Error('offline'); });
  await queue.enqueue({ id: 'retry' });
  await assert.rejects(queue.flush(), /offline/);
  assert.equal(items().length, 1);
  fail = false;
  await queue.flush();
  assert.deepEqual(items(), []);
});

test('permanently rejected events do not block later history', async () => {
  const sent = [];
  const { queue, items } = fixture(async (item) => {
    if (item.id === 'expired') throw new Error('expired');
    sent.push(item.id);
  }, () => true, (error) => error.message === 'expired');
  await queue.enqueue({ id: 'expired' });
  await queue.enqueue({ id: 'valid' });
  await queue.flush();
  assert.deepEqual(sent, ['valid']);
  assert.deepEqual(items(), []);
});

test('disposal drains in-flight sends without writing after account cleanup', async () => {
  let finish;
  const { queue, items } = fixture(async () => new Promise((resolve) => { finish = resolve; }));
  await queue.enqueue({ id: 'pending' });
  const flushing = queue.flush();
  while (!finish) await new Promise((resolve) => setImmediate(resolve));
  const disposal = queue.dispose();
  await queue.enqueue({ id: 'too-late' });
  finish();
  await Promise.all([flushing, disposal]);
  assert.deepEqual(items(), [{ id: 'pending' }]);
});
