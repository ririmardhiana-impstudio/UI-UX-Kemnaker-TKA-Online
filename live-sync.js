/**
 * @fileoverview Live sync (status: draft). Calls `refresh` whenever data may
 * have changed elsewhere so a page that stays open follows other accounts in
 * real time: another tab/window writing to localStorage (`storage` event —
 * the mock store), the tab becoming visible/focused again, and a polling
 * tick while visible (the path that also works against a real backend).
 * Refreshes never overlap. Use cases: akun Direktur (Penerbitan HPK +
 * Pengesahan/Perpanjangan RPTKA); reusable for Validator, Simponi,
 * Verifikator.
 */

const DEFAULT_INTERVAL_MS = 4000;
const STORAGE_DEBOUNCE_MS = 150;

/**
 * @param {function(): (Promise<void>|void)} refresh Reloads + re-renders only
 *     when the data actually changed.
 * @param {{intervalMs: (number|undefined)}=} options
 * @return {function()} stop
 */
export function startLiveSync(refresh, { intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  let running = false;
  let debounce = 0;

  const run = async () => {
    if (running || document.hidden) {
      return;
    }
    running = true;
    try {
      await refresh();
    } catch (error) {
      console.warn('[live-sync] refresh gagal', error);
    } finally {
      running = false;
    }
  };
  const onStorage = () => {
    // Let other storage listeners (the mock store reload) run first.
    clearTimeout(debounce);
    debounce = setTimeout(run, STORAGE_DEBOUNCE_MS);
  };
  const onVisible = () => {
    if (!document.hidden) {
      run();
    }
  };

  const timer = setInterval(run, intervalMs);
  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', run);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(timer);
    clearTimeout(debounce);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('focus', run);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
