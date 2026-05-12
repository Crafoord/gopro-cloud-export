import { Config } from './types';

const BASE = '/api';

async function post(path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`);
  return res.json();
}

export const api = {
  getConfig: (): Promise<Config> => get('/config'),
  saveConfig: (updates: Partial<Config>): Promise<Config> => post('/config', updates),
  validateToken: (token: string): Promise<{ valid: boolean; error?: string }> =>
    post('/auth/validate', { token }),
  scan: () => post('/scan'),
  downloadStart: () => post('/download/start'),
  downloadPause: () => post('/download/pause'),
  downloadResume: () => post('/download/resume'),
  getState: () => get('/state'),
  retryFailed: () => post('/download/retry-failed'),
  retrySingle: (id: string) => post(`/download/retry/${id}`),
  browseFolder: (): Promise<{ path?: string; cancelled?: boolean }> => get('/browse-folder'),
  toggleBroken: (id: string) => post(`/media/${id}/toggle-broken`),
};
