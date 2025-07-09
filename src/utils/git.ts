import { spawn } from 'child_process';
import { getWorkingDirectory } from '../config';

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

export async function isGitRepo(): Promise<boolean> {
  try {
    const workingDir = getWorkingDirectory();

    await execCommand('git', ['rev-parse', '--git-dir'], workingDir);

    return true;
  } catch {
    return false;
  }
}

export async function initGitRepo(): Promise<void> {
  const workingDir = getWorkingDirectory();

  await execCommand('git', ['init'], workingDir);
  await execCommand('git', ['config', 'user.email', 'mcp-tasks@example.com'], workingDir);
  await execCommand('git', ['config', 'user.name', 'MCP Tasks Server'], workingDir);
}

export async function hasUntrackedFiles(): Promise<boolean> {
  try {
    const workingDir = getWorkingDirectory();
    const output = await execCommand('git', ['status', '--porcelain'], workingDir);

    return output.trim().length > 0;
  } catch {
    return false;
  }
}

export async function commitChanges(message: string): Promise<void> {
  const workingDir = getWorkingDirectory();

  await execCommand('git', ['add', '.'], workingDir);
  await execCommand('git', ['commit', '-m', message], workingDir);
}
