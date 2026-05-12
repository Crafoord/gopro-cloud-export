import { useState, useEffect, useCallback } from 'react';
import { AppState, Config, Phase, VideoEntry } from './types';
import { api } from './api';
import { useSSE } from './hooks/useSSE';
import Setup from './components/Setup';
import Dashboard from './components/Dashboard';

const initialState: AppState = {
  phase: 'idle',
  scan: null,
  download: null,
  videos: [],
};

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [appState, setAppState] = useState<AppState>(initialState);
  const [view, setView] = useState<'setup' | 'dashboard'>('setup');

  useEffect(() => {
    api.getConfig().then(setConfig);
    api.getState().then((state) => {
      if (state.phase !== 'idle') {
        setAppState(state);
        setView('dashboard');
      }
    });
  }, []);

  const handleSSE = useCallback((type: string, data: any) => {
    // scan_complete: re-fetch full state so the video list (with mediaTokens) is populated
    if (type === 'scan_complete') {
      api.getState().then(setAppState);
      return;
    }

    setAppState((prev) => {
      switch (type) {
        case 'phase_change':
          return { ...prev, phase: data.phase as Phase };

        case 'scan_progress':
          return { ...prev, scan: { scanned: data.scanned, total: data.total ?? 0 } };

        case 'download_progress': {
          const videos = prev.videos.map((v) =>
            v.id === data.id ? { ...v, downloadedBytes: data.bytes, status: 'downloading' as const } : v
          );
          const currentIP = prev.download?.inProgress ?? [];
          const newEntry = { id: data.id, filename: data.filename, percent: data.percent, bytesPerSecond: data.bytesPerSecond };
          const inProgress = currentIP.some(x => x.id === data.id)
            ? currentIP.map(x => x.id === data.id ? newEntry : x)
            : [...currentIP, newEntry];
          return {
            ...prev,
            videos,
            download: prev.download
              ? { ...prev.download, inProgress }
              : { total: 0, downloaded: 0, failed: 0, skipped: 0, inProgress, bytesPerSecond: data.bytesPerSecond, eta: null },
          };
        }

        case 'download_complete': {
          const videos = prev.videos.map((v) =>
            v.id === data.id ? { ...v, status: (data.skipped ? 'skipped' : 'complete') as VideoEntry['status'] } : v
          );
          const inProgress = (prev.download?.inProgress ?? []).filter(x => x.id !== data.id);
          return { ...prev, videos, download: prev.download ? { ...prev.download, inProgress } : null };
        }

        case 'download_error': {
          const videos = prev.videos.map((v) =>
            v.id === data.id ? { ...v, status: 'failed' as const, error: data.error } : v
          );
          const inProgress = (prev.download?.inProgress ?? []).filter(x => x.id !== data.id);
          return { ...prev, videos, download: prev.download ? { ...prev.download, inProgress } : null };
        }

        case 'overall_progress':
          return {
            ...prev,
            download: {
              total: data.total,
              downloaded: data.downloaded,
              failed: data.failed,
              skipped: data.skipped,
              inProgress: prev.download?.inProgress ?? [],
              bytesPerSecond: data.bytesPerSecond,
              eta: data.eta,
            },
          };

        default:
          return prev;
      }
    });
  }, []);

  useSSE(handleSSE);

  const handleScan = async () => {
    await api.scan();
    const state = await api.getState();
    setAppState(state);
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">GoPro Exporter</h1>
        <nav className="flex gap-4 text-sm">
          <button
            onClick={() => setView('setup')}
            className={`px-3 py-1 rounded ${view === 'setup' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Setup
          </button>
          <button
            onClick={() => setView('dashboard')}
            className={`px-3 py-1 rounded ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Dashboard
          </button>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {view === 'setup' ? (
          <Setup config={config} onSave={(updated) => { setConfig(updated); setView('dashboard'); }} />
        ) : (
          <Dashboard
            appState={appState}
            onScan={handleScan}
            onStart={() => api.downloadStart()}
            onPause={() => api.downloadPause()}
            onResume={() => api.downloadResume()}
            onRetryFailed={async () => {
              await api.retryFailed();
              const state = await api.getState();
              setAppState(state);
            }}
            onRetrySingle={async (id) => {
              await api.retrySingle(id);
              setAppState((prev) => ({
                ...prev,
                videos: prev.videos.map((v) => v.id === id ? { ...v, status: 'pending', error: null } : v),
              }));
            }}
            onToggleBroken={async (id) => {
              await api.toggleBroken(id);
              setAppState((prev) => ({
                ...prev,
                videos: prev.videos.map((v) =>
                  v.id === id
                    ? { ...v, status: v.status === 'broken' ? 'failed' : 'broken', error: v.status === 'broken' ? v.error : null }
                    : v
                ),
              }));
            }}
          />
        )}
      </main>
    </div>
  );
}
