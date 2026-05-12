import fs from 'fs';
import os from 'os';
import path from 'path';
import { Config } from './types';

const DATA_DIR = path.join(os.homedir(), '.gopro-exporter');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

const DEFAULTS: Config = {
  downloadPath: path.join(process.env.HOME || '~', 'Downloads', 'gopro-export'),
  concurrency: 3,
  token: null,
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadConfig(): Config {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    return { ...DEFAULTS };
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(updates: Partial<Config>): Config {
  ensureDataDir();
  const current = loadConfig();
  const next = { ...current, ...updates };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
  return next;
}
