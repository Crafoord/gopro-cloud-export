import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { loadConfig } from './config';
import { loadManifest, saveManifest, updateEntry } from './manifest';
import { getDownloadUrl } from './gopro';
import { isValidVideo } from './validator';
import { sseManager } from './sse';
import { Phase, ManifestEntry } from './types';

interface ActiveDownload {
  id: string;
  filename: string;
  bytes: number;
  totalBytes: number;
  bytesPerSecond: number;
  lastUpdate: number;
  lastBytes: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class DownloadManager {
  private phase: Phase = 'idle';
  private activeDownloads: Map<string, ActiveDownload> = new Map();
  private paused = false;
  private abortControllers: Map<string, AbortController> = new Map();
  // In-memory job queue — JS is single-threaded so shift() is atomic
  private jobQueue: string[] = [];

  getPhase(): Phase {
    return this.phase;
  }

  setPhase(phase: Phase): void {
    this.phase = phase;
    sseManager.broadcast({ type: 'phase_change', data: { phase } });
  }

  async start(): Promise<void> {
    if (this.phase === 'downloading') return;
    this.paused = false;
    this.setPhase('downloading');
    this.runQueue().catch((err) => {
      console.error('Download queue error:', err);
      this.setPhase('idle');
    });
  }

  pause(): void {
    this.paused = true;
    this.jobQueue = [];
    for (const [, controller] of this.abortControllers) {
      controller.abort();
    }
    this.setPhase('paused');
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    this.paused = false;
    this.setPhase('downloading');
    this.runQueue().catch(console.error);
  }

  toggleBroken(id: string): void {
    const manifest = loadManifest();
    if (!manifest.videos[id]) return;
    const entry = manifest.videos[id];

    if (entry.status === 'broken') {
      manifest.videos[id] = { ...entry, status: 'failed' };
    } else {
      const config = loadConfig();
      const partPath = path.join(config.downloadPath, entry.filename + '.part');
      if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
      manifest.videos[id] = { ...entry, status: 'broken', error: null, downloadedBytes: 0 };
    }
    saveManifest(manifest);
  }

  retryFailed(): void {
    const manifest = loadManifest();
    const config = loadConfig();
    const retryIds: string[] = [];

    for (const id of Object.keys(manifest.videos)) {
      // Never retry broken files
      if (manifest.videos[id].status === 'failed') {
        const filename = manifest.videos[id].filename;
        // Delete any corrupt partial file so retry starts fresh
        const partPath = path.join(config.downloadPath, filename + '.part');
        if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
        manifest.videos[id] = { ...manifest.videos[id], status: 'pending', error: null, downloadedBytes: 0 };
        retryIds.push(id);
      }
    }
    saveManifest(manifest);

    // If workers are already running, enqueue directly — they'll pick items up immediately
    if (this.phase === 'downloading') {
      this.jobQueue.push(...retryIds);
    }
  }

  retrySingle(id: string): void {
    const manifest = loadManifest();
    if (!manifest.videos[id]) return;

    const config = loadConfig();
    const partPath = path.join(config.downloadPath, manifest.videos[id].filename + '.part');
    if (fs.existsSync(partPath)) fs.unlinkSync(partPath);

    manifest.videos[id] = { ...manifest.videos[id], status: 'pending', error: null, downloadedBytes: 0 };
    saveManifest(manifest);

    if (this.phase === 'downloading') {
      this.jobQueue.push(id);
    }
  }

  private async runQueue(): Promise<void> {
    const manifest = loadManifest();
    this.jobQueue = Object.values(manifest.videos)
      .filter((v) => v.status === 'pending')
      .map((v) => v.id);

    if (this.jobQueue.length === 0) {
      this.setPhase('complete');
      return;
    }

    const config = loadConfig();
    // Spawn N workers — each independently pops the next job as soon as it's free
    const workers = Array.from({ length: config.concurrency }, () => this.worker());
    await Promise.all(workers);

    if (!this.paused) {
      const final = loadManifest();
      const allDone = Object.values(final.videos).every(
        (v) => v.status === 'complete' || v.status === 'failed' || v.status === 'skipped' || v.status === 'broken'
      );
      if (allDone) this.setPhase('complete');
    }
  }

  private async worker(): Promise<void> {
    while (!this.paused) {
      const id = this.jobQueue.shift();
      if (id === undefined) break;

      const manifest = loadManifest();
      const item = manifest.videos[id];
      if (!item || item.status !== 'pending') continue;

      await this.downloadOne(item);
    }
  }

  private async downloadOne(item: ManifestEntry): Promise<void> {
    const config = loadConfig();
    const destDir = config.downloadPath;

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const finalPath = path.join(destDir, item.filename);
    const partPath = finalPath + '.part';

    // Final file exists and is valid — skip
    if (fs.existsSync(finalPath) && await isValidVideo(finalPath)) {
      updateEntry(item.id, { status: 'complete', localPath: finalPath });
      sseManager.broadcast({ type: 'download_complete', data: { id: item.id, filename: item.filename, skipped: true } });
      this.emitOverall();
      return;
    }

    updateEntry(item.id, { status: 'downloading' });

    const controller = new AbortController();
    this.abortControllers.set(item.id, controller);

    let startByte = 0;
    if (fs.existsSync(partPath)) {
      startByte = fs.statSync(partPath).size;
    }

    const active: ActiveDownload = {
      id: item.id,
      filename: item.filename,
      bytes: startByte,
      totalBytes: item.size,
      bytesPerSecond: 0,
      lastUpdate: Date.now(),
      lastBytes: startByte,
    };
    this.activeDownloads.set(item.id, active);

    sseManager.broadcast({
      type: 'download_started',
      data: { id: item.id, filename: item.filename, totalBytes: item.size },
    });

    try {
      const token = config.token!;
      const url = await getDownloadUrl(token, item.id);

      const response = await axios.get(url, {
        responseType: 'stream',
        signal: controller.signal as any,
        headers: startByte > 0 ? { Range: `bytes=${startByte}-` } : {},
      });

      const contentLength = parseInt(String(response.headers['content-length'] || '0'), 10);
      active.totalBytes = startByte + contentLength || item.size;

      const fileStream = fs.createWriteStream(partPath, { flags: startByte > 0 ? 'a' : 'w' });

      await new Promise<void>((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          active.bytes += chunk.length;

          const now = Date.now();
          const elapsed = (now - active.lastUpdate) / 1000;
          if (elapsed >= 0.5) {
            active.bytesPerSecond = (active.bytes - active.lastBytes) / elapsed;
            active.lastUpdate = now;
            active.lastBytes = active.bytes;
          }

          const percent = active.totalBytes > 0
            ? Math.round((active.bytes / active.totalBytes) * 100)
            : 0;

          sseManager.broadcast({
            type: 'download_progress',
            data: {
              id: item.id,
              filename: item.filename,
              bytes: active.bytes,
              totalBytes: active.totalBytes,
              percent,
              bytesPerSecond: active.bytesPerSecond,
            },
          });
          this.emitOverall();
        });

        response.data.on('end', resolve);
        response.data.on('error', reject);
        fileStream.on('error', reject);
        response.data.pipe(fileStream);
      });

      const valid = await isValidVideo(partPath);
      if (valid) {
        fs.renameSync(partPath, finalPath);
        updateEntry(item.id, { status: 'complete', localPath: finalPath, downloadedBytes: active.bytes });
        sseManager.broadcast({ type: 'download_complete', data: { id: item.id, filename: item.filename, skipped: false } });
      } else {
        fs.unlinkSync(partPath);
        updateEntry(item.id, { status: 'failed', error: 'File validation failed after download' });
        sseManager.broadcast({ type: 'download_error', data: { id: item.id, filename: item.filename, error: 'Validation failed' } });
      }
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        // Paused — keep partial file for resume
        updateEntry(item.id, { status: 'pending', downloadedBytes: active.bytes });
      } else {
        // Real failure — delete partial file so retry starts clean
        if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
        updateEntry(item.id, { status: 'failed', error: err.message });
        sseManager.broadcast({ type: 'download_error', data: { id: item.id, filename: item.filename, error: err.message } });
      }
    } finally {
      this.activeDownloads.delete(item.id);
      this.abortControllers.delete(item.id);
      this.emitOverall();
    }
  }

  private emitOverall(): void {
    const manifest = loadManifest();
    const videos = Object.values(manifest.videos);
    const total = videos.length;
    const downloaded = videos.filter((v) => v.status === 'complete').length;
    const failed = videos.filter((v) => v.status === 'failed').length;
    const skipped = videos.filter((v) => v.status === 'skipped').length;

    const totalBps = Array.from(this.activeDownloads.values())
      .reduce((s, a) => s + a.bytesPerSecond, 0);
    const remaining = videos.filter((v) => v.status === 'pending' || v.status === 'downloading');
    const remainingBytes = remaining.reduce((s, v) => s + (v.size - v.downloadedBytes), 0);
    const eta = totalBps > 0 ? Math.round(remainingBytes / totalBps) : null;

    sseManager.broadcast({
      type: 'overall_progress',
      data: { downloaded, total, failed, skipped, bytesPerSecond: totalBps, eta },
    });
  }

  getStateSnapshot() {
    const manifest = loadManifest();
    const videos = Object.values(manifest.videos);
    const total = videos.length;
    if (total === 0) return null;

    const downloaded = videos.filter((v) => v.status === 'complete').length;
    const failed = videos.filter((v) => v.status === 'failed').length;
    const skipped = videos.filter((v) => v.status === 'skipped').length;

    const totalBps = Array.from(this.activeDownloads.values())
      .reduce((s, a) => s + a.bytesPerSecond, 0);
    const remaining = videos.filter((v) => v.status === 'pending' || v.status === 'downloading');
    const remainingBytes = remaining.reduce((s, v) => s + (v.size - v.downloadedBytes), 0);
    const eta = totalBps > 0 ? Math.round(remainingBytes / totalBps) : null;

    const inProgress = Array.from(this.activeDownloads.values()).map((a) => ({
      id: a.id,
      filename: a.filename,
      percent: a.totalBytes > 0 ? Math.round((a.bytes / a.totalBytes) * 100) : 0,
      bytesPerSecond: a.bytesPerSecond,
    }));

    return { total, downloaded, failed, skipped, inProgress, bytesPerSecond: totalBps, eta };
  }
}

export const downloadManager = new DownloadManager();
