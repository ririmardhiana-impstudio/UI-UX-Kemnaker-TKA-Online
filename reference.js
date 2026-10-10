/** @fileoverview Reference data: today, workflow steps, SSO session. */

import { apiGet } from './http.js';

/** @return {!Promise<{today: string}>} */
export function getSystemInfo() {
  return apiGet('/system-info');
}

/** @return {!Promise<{hpk: !Array<string>, pengesahan: !Array<string>}>} */
export function getWorkflowSteps() {
  return apiGet('/workflow-steps');
}

/** @return {!Promise<{name: string, email: string, nik: string}>} */
export function getSsoSession() {
  return apiGet('/sso-sessions/current');
}
