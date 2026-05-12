import { AppState } from '../types';
import FileList from './FileList';

interface Props {
  appState: AppState;
  onScan: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRetryFailed: () => void;
  onRetrySingle: (id: string) => void;
  onToggleBroken: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatEta(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function PhaseLabel({ phase }: { phase: string }) {
  const map: Record<string, { label: string; color: string }> = {
    idle:        { label: 'Idle',         color: 'text-gray-400' },
    scanning:    { label: 'Scanning...',  color: 'text-yellow-400' },
    ready:       { label: 'Ready',        color: 'text-blue-400' },
    downloading: { label: 'Downloading',  color: 'text-green-400' },
    paused:      { label: 'Paused',       color: 'text-orange-400' },
    complete:    { label: 'Complete',     color: 'text-emerald-400' },
  };
  const { label, color } = map[phase] ?? { label: phase, color: 'text-gray-400' };
  return <span className={`font-semibold ${color}`}>{label}</span>;
}

export default function Dashboard({ appState, onScan, onStart, onPause, onResume, onRetryFailed, onRetrySingle, onToggleBroken }: Props) {
  const { phase, scan, download, videos } = appState;
  const totalFiles = download?.total ?? videos.length;
  const downloaded = download?.downloaded ?? videos.filter((v) => v.status === 'complete').length;
  const failed = videos.filter((v) => v.status === 'failed').length;
  const skipped = download?.skipped ?? videos.filter((v) => v.status === 'skipped').length;
  const progress = totalFiles > 0 ? Math.round(((downloaded + skipped) / totalFiles) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Status + actions */}
      <div className="bg-gray-900 rounded-xl p-6 flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400 mb-1">Status</div>
          <PhaseLabel phase={phase} />
        </div>

        <div className="flex gap-3">
          {phase === 'idle' && (
            <button
              onClick={onScan}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium"
            >
              Scan GoPro Cloud
            </button>
          )}
          {phase === 'ready' && (
            <button
              onClick={onStart}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium"
            >
              Start Download
            </button>
          )}
          {phase === 'downloading' && (
            <button
              onClick={onPause}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm font-medium"
            >
              Pause
            </button>
          )}
          {phase === 'paused' && (
            <button
              onClick={onResume}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium"
            >
              Resume
            </button>
          )}
          {failed > 0 && (phase === 'downloading' || phase === 'paused' || phase === 'complete' || phase === 'ready') && (
            <button
              onClick={onRetryFailed}
              className="px-5 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-medium"
            >
              Retry Failed ({failed})
            </button>
          )}
          {(phase === 'ready' || phase === 'complete' || phase === 'paused') && (
            <button
              onClick={onScan}
              className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium"
            >
              Re-scan
            </button>
          )}
        </div>
      </div>

      {/* Scan progress */}
      {phase === 'scanning' && scan && (
        <div className="bg-gray-900 rounded-xl p-6">
          <div className="text-sm text-gray-400 mb-2">Scanning cloud library...</div>
          <div className="text-3xl font-bold">{scan.scanned.toLocaleString()}</div>
          <div className="text-sm text-gray-500 mt-1">videos found</div>
        </div>
      )}

      {/* Stats grid */}
      {totalFiles > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total',      value: totalFiles.toLocaleString(),  color: 'text-white' },
            { label: 'Downloaded', value: downloaded.toLocaleString(),  color: 'text-green-400' },
            { label: 'Skipped',    value: skipped.toLocaleString(),     color: 'text-gray-400' },
            { label: 'Failed',     value: failed.toLocaleString(),      color: failed > 0 ? 'text-red-400' : 'text-gray-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-900 rounded-xl p-4">
              <div className="text-sm text-gray-400">{label}</div>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Overall progress bar */}
      {totalFiles > 0 && (
        <div className="bg-gray-900 rounded-xl p-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Overall Progress</span>
            <span className="font-semibold">{progress}%</span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {download && (phase === 'downloading' || phase === 'paused') && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>{formatBytes(download.bytesPerSecond)}/s</span>
              <span>ETA: {formatEta(download.eta)}</span>
            </div>
          )}
        </div>
      )}

      {/* Active downloads */}
      {download?.inProgress && download.inProgress.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Active Downloads</h3>
          {download.inProgress.map((item) => (
            <div key={item.id} className="space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span className="truncate max-w-xs">{item.filename}</span>
                <span>{item.percent}% · {formatBytes(item.bytesPerSecond)}/s</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full transition-all duration-300"
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File list */}
      {videos.length > 0 && <FileList videos={videos} onRetry={onRetrySingle} onToggleBroken={onToggleBroken} />}
    </div>
  );
}
