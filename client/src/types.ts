export type Phase = 'idle' | 'scanning' | 'ready' | 'downloading' | 'paused' | 'complete';
export type VideoStatus = 'pending' | 'downloading' | 'complete' | 'failed' | 'skipped' | 'broken';

export interface Config {
  downloadPath: string;
  concurrency: number;
  token: string | null;
}

export interface VideoEntry {
  id: string;
  filename: string;
  size: number;
  status: VideoStatus;
  downloadedBytes: number;
  error?: string | null;
}

export interface DownloadState {
  total: number;
  downloaded: number;
  failed: number;
  skipped: number;
  inProgress: Array<{ id: string; filename: string; percent: number; bytesPerSecond: number }>;
  bytesPerSecond: number;
  eta: number | null;
}

export interface AppState {
  phase: Phase;
  scan: { total: number; scanned: number } | null;
  download: DownloadState | null;
  videos: VideoEntry[];
}
