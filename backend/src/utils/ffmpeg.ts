import { spawn } from 'child_process';

export interface ConvertVideoToGifOptions {
  inputPath: string;
  outputPath: string;
  threads?: string;
  maxDurationSeconds?: number;
  maxFrames?: number;
}

export function convertVideoToGif({
  inputPath,
  outputPath,
  threads = '1',
  maxDurationSeconds = 5,
  maxFrames = 40
}: ConvertVideoToGifOptions): Promise<void> {
  const args = [
    '-t',
    String(maxDurationSeconds),
    '-i',
    inputPath,
    '-threads',
    threads,
    '-vf',
    'fps=8,scale=400:-1:flags=fast_bilinear,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=1',
    '-frames:v',
    String(maxFrames),
    '-f',
    'gif',
    '-y',
    outputPath
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => {
      reject(err);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`));
    });
  });
}
