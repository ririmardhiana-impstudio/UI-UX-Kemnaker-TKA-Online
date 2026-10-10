/**
 * @fileoverview Disclosure state for DaisyUI focus dropdowns (user menu,
 * notification bell, "Tambah"): shared by the portal and the Verifikator
 * pages. Moved out of js/pages/portal/shell.js.
 */

/**
 * Disclosure state for DaisyUI focus dropdowns (user menu, "Tambah"):
 * keeps aria-expanded in sync with focus-within and closes on Escape.
 */
export function bindDropdowns() {
  const CLOSED = 'dropdown-close';
  const triggerOf = (dropdown) => dropdown.querySelector('[aria-expanded]');
  const sync = (dropdown) => {
    const open = dropdown.contains(document.activeElement) &&
      !dropdown.classList.contains(CLOSED);
    triggerOf(dropdown)?.setAttribute('aria-expanded', String(open));
  };
  document.addEventListener('focusin', (event) => {
    const dropdown = event.target.closest?.('.dropdown');
    if (dropdown) {
      sync(dropdown);
    }
  });
  document.addEventListener('focusout', (event) => {
    const dropdown = event.target.closest?.('.dropdown');
    if (!dropdown || dropdown.contains(event.relatedTarget)) {
      return;
    }
    dropdown.classList.remove(CLOSED);
    triggerOf(dropdown)?.setAttribute('aria-expanded', 'false');
  });
  let openAtPointerDown = null;
  document.addEventListener('pointerdown', (event) => {
    const dropdown = event.target.closest?.('.dropdown');
    openAtPointerDown = dropdown?.contains(document.activeElement) &&
      !dropdown.classList.contains(CLOSED) ? dropdown : null;
  }, true);
  document.addEventListener('click', (event) => {
    // While open, DaisyUI sets pointer-events:none on the trigger, so a
    // second click lands on the .dropdown itself: toggle closed (legacy).
    if (event.target.matches?.('.dropdown')) {
      if (event.target !== openAtPointerDown) {
        return;
      }
      event.target.classList.add(CLOSED);
      sync(event.target);
      return;
    }
    const trigger = event.target.closest?.('.dropdown [aria-expanded]');
    const dropdown = trigger?.closest('.dropdown');
    if (dropdown?.classList.contains(CLOSED)) {
      dropdown.classList.remove(CLOSED);
      sync(dropdown);
    }
  });
  document.addEventListener('keydown', (event) => {
    const dropdown = event.target.closest?.('.dropdown');
    if (event.key !== 'Escape' || !dropdown) {
      return;
    }
    dropdown.classList.add(CLOSED);
    triggerOf(dropdown)?.focus();
    sync(dropdown);
  });
}
