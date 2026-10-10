/** @fileoverview Regional DKPTKA payment validation (pejabat pemda). */

import { apiGet, apiPost } from './http.js';

export function listPemdaValidations() {
  return apiGet('/pemda-validations');
}

/** @param {string} id @param {'Tervalidasi'|'Ditolak'} decision */
export function decidePemdaValidation(id, decision) {
  return apiPost(`/pemda-validations/${encodeURIComponent(id)}/decision`,
    { decision });
}
