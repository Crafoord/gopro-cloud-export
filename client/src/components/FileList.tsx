import { useState } from 'react';
import { VideoEntry, VideoStatus } from '../types';

interface Props {
  videos: VideoEntry[];
  onRetry?: (id: string) => void;
  onToggleBroken?: (id: string) => void;
}

const STATUS_STYLES: Record<VideoStatus, { dot: string; label: string }> = {
  complete:    { dot: 'bg-green-500',               label: 'Done' },
  skipped:     { dot: 'bg-gray-500',                label: 'Skipped' },
  pending:     { dot: 'bg-gray-700',                label: 'Pending' },
  downloading: { dot: 'bg-blue-500 animate-pulse',  label: 'Downloading' },
  failed:      { dot: 'bg-red-500',                 label: 'Failed' },
  broken:      { dot: 'bg-yellow-500',              label: 'Broken' },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function FileList({ videos, onRetry, onToggleBroken }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sortPriority = (status: VideoStatus) => {
    if (status === 'downloading') return 0;
    if (status === 'failed' || status === 'broken') return 1;  // same group — no jumping on toggle
    if (status === 'pending') return 2;
    if (status === 'complete') return 3;
    return 4; // skipped
  };
  const sorted = [...videos].sort((a, b) => {
    const diff = sortPriority(a.status) - sortPriority(b.status);
    if (diff !== 0) return diff;
    return a.filename.localeCompare(b.filename);
  });

  const counts = videos.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] ?? 0) + 1;
    return acc;
  }, {} as Partial<Record<VideoStatus, number>>);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">All Videos ({videos.length})</h3>
        <div className="flex gap-3 text-xs text-gray-500">
          {(Object.entries(counts) as [VideoStatus, number][]).map(([status, count]) => (
            <span key={status}>
              <span className={`inline-block w-2 h-2 rounded-full mr-1 ${STATUS_STYLES[status]?.dot}`} />
              {count} {status}
            </span>
          ))}
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto space-y-0.5 pr-1">
        {sorted.map((video) => {
          const { dot, label } = STATUS_STYLES[video.status];
          const progress = video.size > 0 && video.downloadedBytes > 0
            ? Math.round((video.downloadedBytes / video.size) * 100)
            : null;
          const isExpandable = video.status === 'failed' || video.status === 'broken';
          const isFailed = video.status === 'failed';
          const isBroken = video.status === 'broken';
          const isExpanded = expanded.has(video.id);

          return (
            <div key={video.id} className="rounded-lg overflow-hidden">
              <div
                className={`flex items-center gap-3 py-2 px-3 hover:bg-gray-800 ${isExpandable ? 'cursor-pointer' : ''}`}
                onClick={() => isExpandable && toggleExpand(video.id)}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                <span className="flex-1 text-sm text-gray-300 truncate">{video.filename}</span>
                {progress !== null && video.status === 'downloading' && (
                  <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                )}
                <span className="text-xs text-gray-500 flex-shrink-0">{formatBytes(video.size)}</span>
                <span className={`text-xs flex-shrink-0 w-16 text-right ${isFailed ? 'text-red-400' : isBroken ? 'text-yellow-400' : 'text-gray-600'}`}>
                  {label} {isExpandable && <span className="text-gray-500">{isExpanded ? '▲' : '▼'}</span>}
                </span>
              </div>

              {isExpandable && isExpanded && (
                <div className="bg-gray-800 px-4 py-3 space-y-3 border-t border-gray-700">
                  {isFailed && (
                    <p className="text-xs text-red-300 font-mono break-all">
                      {video.error ?? 'Unknown error'}
                    </p>
                  )}
                  {isBroken && (
                    <p className="text-xs text-yellow-300">
                      Marked as broken — will not be downloaded.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 items-center">
                    <a
                      href={`https://gopro.com/media-library/${video.id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-gray-200"
                    >
                      View on GoPro
                    </a>
                    {onRetry && isFailed && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRetry(video.id); toggleExpand(video.id); }}
                        className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-200"
                      >
                        Retry download
                      </button>
                    )}
                    {onToggleBroken && (
                      <label
                        className="flex items-center gap-2 cursor-pointer select-none ml-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isBroken}
                          onChange={() => onToggleBroken(video.id)}
                          className="accent-yellow-400 w-3.5 h-3.5"
                        />
                        <span className="text-xs text-yellow-400">Broken on GoPro</span>
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
