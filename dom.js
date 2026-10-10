/**
 * @fileoverview Small DOM helpers shared by every page. All text coming
 * from data is escaped: use `html` (auto-escaping tagged template) or
 * `renderList` (<template> cloning + textContent).
 */

/** Marker for trusted, already-escaped HTML. */
class SafeHtml {
  /** @param {string} value */
  constructor(value) {
    /** @const {string} */
    this.value = value;
  }

  /** @override */
  toString() {
    return this.value;
  }
}

const ESCAPE_MAP = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;',
};

/** querySelector shortcut. */
export function qs(selector, root = document) {
  return root.querySelector(selector);
}

/** querySelectorAll as array. */
export function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

/**
 * Escape a value for safe HTML text/attribute interpolation.
 * @param {*} value
 * @return {string}
 */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

/**
 * Mark a string as trusted HTML (only for markup built by this codebase,
 * never for API data).
 * @param {string} value
 * @return {!SafeHtml}
 */
export function raw(value) {
  return new SafeHtml(value);
}

/**
 * Tagged template that escapes every interpolation except SafeHtml
 * values (and arrays of them).
 * Booleans placed directly inside a quoted attribute value render as
 * "true"/"false" (so aria-pressed="${isActive}" stays valid ARIA); in
 * text position `false` still renders nothing.
 * Example: el.innerHTML = html`<b>${user.name}</b>${raw(icon)}`;
 * @return {!SafeHtml}
 */
export function html(strings, ...values) {
  const out = strings.reduce((acc, part, i) => {
    if (i >= values.length) {
      return acc + part;
    }
    const value = values[i];
    const isAttrBoolean = typeof value === 'boolean' && part.endsWith('="');
    return acc + part + (isAttrBoolean ? String(value) : interpolate(value));
  }, '');
  return new SafeHtml(out);
}

/** Replace element content with SafeHtml. */
export function setHtml(element, safe) {
  if (!(safe instanceof SafeHtml)) {
    throw new Error('setHtml expects SafeHtml; build it with html``.');
  }
  element.innerHTML = safe.value;
}

/**
 * Render items by cloning a <template>. `fill` receives the cloned root
 * element; use setText()/data-slot to write data safely.
 * @param {!Element} container Target list container (cleared first).
 * @param {!HTMLTemplateElement} template
 * @param {!Array<*>} items
 * @param {function(!Element, *, number)} fill
 */
export function renderList(container, template, items, fill) {
  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => {
    const clone = template.content.firstElementChild.cloneNode(true);
    fill(clone, item, index);
    fragment.appendChild(clone);
  });
  container.replaceChildren(fragment);
}

/**
 * Write values into [data-slot="key"] descendants via textContent.
 * @param {!Element} root
 * @param {!Object<string, *>} values
 */
export function fillSlots(root, values) {
  for (const el of qsa('[data-slot]', root)) {
    const key = el.dataset.slot;
    if (key in values) {
      el.textContent = values[key] ?? '';
    }
  }
}

/** Show an element (removes the `hidden` attribute). */
export function show(element) {
  element.hidden = false;
}

/** Hide an element (sets the `hidden` attribute). */
export function hide(element) {
  element.hidden = true;
}

/** Toggle visibility. */
export function setVisible(element, isVisible) {
  element.hidden = !isVisible;
}

/** Reflect loading state for assistive tech. */
export function setBusy(element, isBusy) {
  element.setAttribute('aria-busy', String(isBusy));
}

function interpolate(value) {
  if (value instanceof SafeHtml) {
    return value.value;
  }
  if (Array.isArray(value)) {
    return value.map(interpolate).join('');
  }
  if (value === false || value === null || value === undefined) {
    return '';
  }
  return escapeHtml(value);
}
