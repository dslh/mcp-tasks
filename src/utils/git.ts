import { spawn } from 'child_process';
import { getWorkingDirectory } from '../config.js';

async function execCommand(command: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
  });
}

export async function commitChanges(message: string): Promise<void> {
  const workingDir = getWorkingDirectory();

  await execCommand('git', ['add', '.'], workingDir);
  await execCommand('git', ['commit', '-m', message], workingDir);
}
