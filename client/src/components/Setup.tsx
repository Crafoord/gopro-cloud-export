import { useState } from 'react';
import { Config } from '../types';
import { api } from '../api';

interface Props {
  config: Config;
  onSave: (config: Config) => void;
}

export default function Setup({ config, onSave }: Props) {
  const [token, setToken] = useState(config.token ?? '');
  const [downloadPath, setDownloadPath] = useState(config.downloadPath);
  const [concurrency, setConcurrency] = useState(config.concurrency);
  const [validating, setValidating] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [saving, setSaving] = useState(false);

  const validateToken = async () => {
    if (!token.trim()) return;
    setValidating(true);
    setTokenStatus('idle');
    const result = await api.validateToken(token.trim());
    setTokenStatus(result.valid ? 'valid' : 'invalid');
    setValidating(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const updated = await api.saveConfig({
      token: token.trim() || null,
      downloadPath,
      concurrency,
    });
    setSaving(false);
    onSave(updated);
  };

  return (
    <div className="space-y-8">
      <section className="bg-gray-900 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">GoPro Session Cookie</h2>

        <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300 space-y-2">
          <p className="font-medium text-gray-100">How to get your session cookie:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-400">
            <li>Open <span className="text-blue-400">gopro.com</span> in your browser and log in</li>
            <li>Open DevTools (F12 or Cmd+Option+I) → Network tab</li>
            <li>Filter by <code className="bg-gray-700 px-1 rounded">Fetch/XHR</code>, then click around your media library</li>
            <li>Click any request to <code className="bg-gray-700 px-1 rounded">api.gopro.com</code> → Request Headers</li>
            <li>Find the <code className="bg-gray-700 px-1 rounded">Cookie</code> header and copy its entire value</li>
          </ol>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-gray-400">Session Cookie</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => { setToken(e.target.value); setTokenStatus('idle'); }}
              placeholder="Paste the Cookie header value here..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={validateToken}
              disabled={validating || !token.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium"
            >
              {validating ? 'Checking...' : 'Validate'}
            </button>
          </div>
          {tokenStatus === 'valid' && (
            <p className="text-sm text-green-400">✓ Token is valid</p>
          )}
          {tokenStatus === 'invalid' && (
            <p className="text-sm text-red-400">✗ Token is invalid or expired</p>
          )}
        </div>
      </section>

      <section className="bg-gray-900 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Download Settings</h2>

        <div className="space-y-2">
          <label className="block text-sm text-gray-400">Download Folder</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={downloadPath}
              onChange={(e) => setDownloadPath(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={async () => {
                const result = await api.browseFolder();
                if (result.path) setDownloadPath(result.path);
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium flex-shrink-0"
            >
              Browse
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-gray-400">
            Parallel Downloads: <span className="text-white font-medium">{concurrency}</span>
          </label>
          <input
            type="range"
            min={1}
            max={8}
            value={concurrency}
            onChange={(e) => setConcurrency(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>1 (slower, safer)</span>
            <span>8 (faster, more bandwidth)</span>
          </div>
        </div>
      </section>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl font-semibold text-sm"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
