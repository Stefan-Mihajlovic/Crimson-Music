type Cleanup = (uid: string) => void | Promise<void>;
const cleanups = new Set<Cleanup>();
const deletedAccounts = new Set<string>();

export function isAccountDeleted(uid: string) {
  return deletedAccounts.has(uid);
}

export function activateAccount(uid: string) {
  deletedAccounts.delete(uid);
}

export function registerAccountCleanup(cleanup: Cleanup) {
  cleanups.add(cleanup);
  return () => { cleanups.delete(cleanup); };
}

export async function disposeDeletedAccount(uid: string) {
  deletedAccounts.add(uid);
  const results = await Promise.allSettled([...cleanups].map((cleanup) => cleanup(uid)));
  const failed = results.find((result) => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}
