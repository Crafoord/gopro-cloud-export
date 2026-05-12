import ffprobe from 'ffprobe-static';
import { spawn } from 'child_process';
import fs from 'fs';

export async function isValidVideo(filePath: string): Promise<boolean> {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  if (stat.size === 0) return false;

  return new Promise((resolve) => {
    const proc = spawn(ffprobe.path, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'default=noprint_wrappers=1',
      filePath,
    ]);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      resolve(code === 0 && stdout.includes('codec_type=video') && stderr.trim() === '');
    });
  });
}
