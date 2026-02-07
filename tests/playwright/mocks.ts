import { Page } from '@playwright/test';

const PROFILE_STORAGE_KEY = 'knez_connection_profile';
const SESSION_STORAGE_KEY = 'knez_session_id';

export async function setKnezEndpoint(page: Page, endpoint: string) {
  await page.addInitScript(
    ({ endpoint }) => {
      const profile = {
        id: 'e2e-live',
        type: 'local',
        transport: 'http',
        endpoint,
        trustLevel: 'untrusted',
      };
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      localStorage.removeItem(SESSION_STORAGE_KEY);
    },
    { endpoint }
  );
}

export async function isKnezReachable(page: Page, endpoint: string): Promise<boolean> {
  const base = endpoint.replace(/\/$/, '');
  try {
    const resp = await page.request.get(`${base}/health`);
    return resp.ok();
  } catch {
    return false;
  }
}

export async function waitForKnezReachable(
  page: Page,
  endpoint: string,
  timeoutMs = 15000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isKnezReachable(page, endpoint)) return;
    await page.waitForTimeout(250);
  }
  throw new Error('knez_unreachable_timeout');
}
