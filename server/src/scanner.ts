import { loadConfig } from './config';
import { buildManifestFromScan } from './manifest';
import { listAllVideos } from './gopro';
import { sseManager } from './sse';
import { downloadManager } from './downloader';
import { MediaItem } from './types';

let scanning = false;

export async function startScan(): Promise<void> {
  if (scanning) return;
  scanning = true;
  downloadManager.setPhase('scanning');

  try {
    const config = loadConfig();
    if (!config.token) throw new Error('No token configured');

    const items: MediaItem[] = [];

    for await (const item of listAllVideos(config.token, (scanned, total) => {
      sseManager.broadcast({ type: 'scan_progress', data: { scanned, total } });
    })) {
      items.push(item);
    }

    buildManifestFromScan(items);
    sseManager.broadcast({ type: 'scan_complete', data: { total: items.length } });
    downloadManager.setPhase('ready');
  } catch (err: any) {
    console.error('Scan error:', err);
    sseManager.broadcast({ type: 'phase_change', data: { phase: 'idle' } });
  } finally {
    scanning = false;
  }
}
