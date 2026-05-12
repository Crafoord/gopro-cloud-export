import express from 'express';
import cors from 'cors';
import path from 'path';
import { loadConfig, saveConfig } from './config';
import { validateToken } from './gopro';
import { loadManifest } from './manifest';
import { sseManager } from './sse';
import { startScan } from './scanner';
import { downloadManager } from './downloader';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve built client in production
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

// SSE
app.get('/api/events', (req, res) => {
  sseManager.addClient(res);
});

// Config
app.get('/api/config', (req, res) => {
  res.json(loadConfig());
});

app.post('/api/config', (req, res) => {
  const { downloadPath, concurrency, token } = req.body;
  const updated = saveConfig({ downloadPath, concurrency, token });
  res.json(updated);
});

// Folder picker (cross-platform)
app.get('/api/browse-folder', async (req, res) => {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const os = await import('os');
  const execAsync = promisify(exec);

  try {
    let picked: string | null = null;
    const platform = os.platform();

    if (platform === 'darwin') {
      const { stdout } = await execAsync(
        `osascript -e 'POSIX path of (choose folder with prompt "Select download folder")'`
      );
      picked = stdout.trim() || null;
    } else if (platform === 'win32') {
      const ps = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$d = New-Object System.Windows.Forms.FolderBrowserDialog',
        '$d.Description = "Select download folder"',
        'if ($d.ShowDialog() -eq "OK") { $d.SelectedPath }',
      ].join('; ');
      const { stdout } = await execAsync(`powershell -NoProfile -STA -Command "${ps}"`);
      picked = stdout.trim() || null;
    } else {
      // Linux: try zenity, fall back to kdialog
      try {
        const { stdout } = await execAsync('zenity --file-selection --directory --title="Select download folder"');
        picked = stdout.trim() || null;
      } catch {
        const { stdout } = await execAsync('kdialog --getexistingdirectory "Select download folder"');
        picked = stdout.trim() || null;
      }
    }

    picked ? res.json({ path: picked }) : res.json({ cancelled: true });
  } catch {
    res.json({ cancelled: true });
  }
});

// Auth
app.post('/api/auth/validate', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ valid: false, error: 'Token required' });
  const valid = await validateToken(token);
  res.json({ valid, error: valid ? undefined : 'Token invalid or expired' });
});

// Scan
app.post('/api/scan', (req, res) => {
  startScan().catch(console.error);
  res.json({ success: true });
});

// Download
app.post('/api/download/start', (req, res) => {
  downloadManager.start().catch(console.error);
  res.json({ success: true });
});

app.post('/api/download/pause', (req, res) => {
  downloadManager.pause();
  res.json({ success: true });
});

app.post('/api/download/resume', (req, res) => {
  downloadManager.resume();
  res.json({ success: true });
});

app.post('/api/download/retry-failed', (req, res) => {
  downloadManager.retryFailed();
  downloadManager.start().catch(console.error);
  res.json({ success: true });
});

app.post('/api/download/retry/:id', (req, res) => {
  downloadManager.retrySingle(req.params.id);
  downloadManager.start().catch(console.error);
  res.json({ success: true });
});

app.post('/api/media/:id/toggle-broken', (req, res) => {
  downloadManager.toggleBroken(req.params.id);
  res.json({ success: true });
});

// Temporary debug: returns the raw first media item from GoPro API so we can verify field names
app.get('/api/debug/sample-media', async (req, res) => {
  const config = loadConfig();
  if (!config.token) return res.status(400).json({ error: 'No token' });
  try {
    const { createGoProClient } = await import('./gopro');
    const client = createGoProClient(config.token);
    const response = await client.get('/media/search', {
      params: { type: 'Video', per_page: 1, page: 1 },
    });
    res.json(response.data._embedded?.media?.[0] ?? { error: 'No media found' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// State snapshot
app.get('/api/state', (req, res) => {
  const manifest = loadManifest();
  const videos = Object.values(manifest.videos);
  const phase = downloadManager.getPhase();

  res.json({
    phase,
    download: downloadManager.getStateSnapshot(),
    videos: videos.map((v) => ({
      id: v.id,
      filename: v.filename,
      size: v.size,
      status: v.status,
      downloadedBytes: v.downloadedBytes,
      error: v.error ?? null,
    })),
  });
});

// Fallback to client app
app.get('*', (req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) res.status(404).send('Client not built yet. Run: npm run build --workspace=client');
  });
});

app.listen(PORT, () => {
  console.log(`GoPro Exporter running at http://localhost:${PORT}`);
});
