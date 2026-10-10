/** @fileoverview Employer (pemberi kerja) profiles. */

import { apiGet } from './http.js';

/** @param {string} role swasta | lembaga | pemerintah */
export function getCompany(role) {
  return apiGet(`/companies/${encodeURIComponent(role)}`);
}

/** All demo employer profiles. */
export function listCompanies() {
  return apiGet('/companies');
}
