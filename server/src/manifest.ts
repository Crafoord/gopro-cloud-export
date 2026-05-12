import fs from 'fs';
import os from 'os';
import path from 'path';
import { Manifest, ManifestEntry, MediaItem } from './types';

const DATA_DIR = path.join(os.homedir(), '.gopro-exporter');
const MANIFEST_PATH = path.join(DATA_DIR, 'manifest.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadManifest(): Manifest {
  ensureDataDir();
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { lastScan: null, videos: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  } catch {
    return { lastScan: null, videos: {} };
  }
}

export function saveManifest(manifest: Manifest): void {
  ensureDataDir();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

export function updateEntry(id: string, updates: Partial<ManifestEntry>): void {
  const manifest = loadManifest();
  if (manifest.videos[id]) {
    manifest.videos[id] = { ...manifest.videos[id], ...updates };
    saveManifest(manifest);
  }
}

export function buildManifestFromScan(items: MediaItem[]): Manifest {
  const existing = loadManifest();
  const videos: Record<string, ManifestEntry> = {};

  for (const item of items) {
    const prev = existing.videos[item.id];
    const preservedStatus = prev?.status === 'complete' || prev?.status === 'broken' ? prev.status : 'pending';
    videos[item.id] = {
      ...item,
      status: preservedStatus,
      localPath: prev?.localPath ?? null,
      downloadedBytes: prev?.downloadedBytes ?? 0,
      error: preservedStatus === 'broken' ? null : (prev?.error ?? null),
    };
  }

  const manifest: Manifest = { lastScan: new Date().toISOString(), videos };
  saveManifest(manifest);
  return manifest;
}
