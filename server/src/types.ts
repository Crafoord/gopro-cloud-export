export interface Config {
  downloadPath: string;
  concurrency: number;
  token: string | null;
}

export interface MediaItem {
  id: string;
  filename: string;
  size: number;
  capturedAt: string;
}

export type DownloadStatus = 'pending' | 'downloading' | 'complete' | 'failed' | 'skipped' | 'broken';

export interface ManifestEntry extends MediaItem {
  status: DownloadStatus;
  localPath: string | null;
  downloadedBytes: number;
  error: string | null;
}

export interface Manifest {
  lastScan: string | null;
  videos: Record<string, ManifestEntry>;
}

export type Phase = 'idle' | 'scanning' | 'ready' | 'downloading' | 'paused' | 'complete';

export interface StateSnapshot {
  phase: Phase;
  scan: { total: number; scanned: number } | null;
  download: {
    total: number;
    downloaded: number;
    failed: number;
    skipped: number;
    inProgress: Array<{ id: string; filename: string; percent: number; bytesPerSecond: number }>;
    bytesPerSecond: number;
    eta: number | null;
  } | null;
}

export type SSEPayload =
  | { type: 'scan_progress'; data: { scanned: number; total: number | null } }
  | { type: 'scan_complete'; data: { total: number } }
  | { type: 'download_started'; data: { id: string; filename: string; totalBytes: number } }
  | { type: 'download_progress'; data: { id: string; filename: string; bytes: number; totalBytes: number; percent: number; bytesPerSecond: number } }
  | { type: 'download_complete'; data: { id: string; filename: string; skipped: boolean } }
  | { type: 'download_error'; data: { id: string; filename: string; error: string } }
  | { type: 'overall_progress'; data: { downloaded: number; total: number; failed: number; skipped: number; bytesPerSecond: number; eta: number | null } }
  | { type: 'phase_change'; data: { phase: Phase } };
