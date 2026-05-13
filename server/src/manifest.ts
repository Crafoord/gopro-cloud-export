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

export function buildManifestFromScan(items: MediaItem[], downloadPath: string): Manifest {
  const existing = loadManifest();
  const videos: Record<string, ManifestEntry> = {};

  for (const item of items) {
    const prev = existing.videos[item.id];

    let status: ManifestEntry['status'];
    let localPath: string | null = prev?.localPath ?? null;

    if (prev?.status === 'broken') {
      status = 'broken';
    } else {
      const expectedPath = localPath ?? path.join(downloadPath, item.filename);
      if (fs.existsSync(expectedPath)) {
        status = 'complete';
        localPath = expectedPath;
      } else {
        status = 'pending';
        localPath = null;
      }
    }

    videos[item.id] = {
      ...item,
      status,
      localPath,
      downloadedBytes: prev?.downloadedBytes ?? 0,
      error: status === 'broken' ? null : (prev?.error ?? null),
    };
  }

  const manifest: Manifest = { lastScan: new Date().toISOString(), videos };
  saveManifest(manifest);
  return manifest;
}
