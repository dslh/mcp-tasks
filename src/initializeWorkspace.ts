import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const CURRENT_TEMPLATE = `# Last Week

# This Week

# Next Week
`;

const BACKLOG_TEMPLATE = `# Backlog
`;

const ARCHIVE_TEMPLATE = `# Archive
`;

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

async function isGitRepo(workingDir: string): Promise<boolean> {
  try {
    await execCommand('git', ['rev-parse', '--git-dir'], workingDir);

    return true;
  } catch {
    return false;
  }
}

async function initGitRepo(workingDir: string): Promise<void> {
  await execCommand('git', ['init'], workingDir);
  await execCommand('git', ['config', 'user.email', 'mcp-tasks@example.com'], workingDir);
  await execCommand('git', ['config', 'user.name', 'MCP Tasks Server'], workingDir);
}

async function hasUntrackedFiles(workingDir: string): Promise<boolean> {
  try {
    const output = await execCommand('git', ['status', '--porcelain'], workingDir);

    return output.trim().length > 0;
  } catch {
    return false;
  }
}

async function commitChanges(workingDir: string, message: string): Promise<void> {
  await execCommand('git', ['add', '.'], workingDir);
  await execCommand('git', ['commit', '-m', message], workingDir);
}

export async function initializeWorkspace(workingDir: string): Promise<void> {
  // Create directory if it doesn't exist
  if (!existsSync(workingDir)) {
    mkdirSync(workingDir, { recursive: true });
  }

  // Initialize git repository if it doesn't exist
  if (!(await isGitRepo(workingDir))) {
    await initGitRepo(workingDir);
  }

  // Create markdown files if they don't exist
  const files = [
    { name: 'current.md', template: CURRENT_TEMPLATE },
    { name: 'backlog.md', template: BACKLOG_TEMPLATE },
    { name: 'archive.md', template: ARCHIVE_TEMPLATE },
  ];

  for (const file of files) {
    const filePath = join(workingDir, file.name);

    if (!existsSync(filePath)) {
      writeFileSync(filePath, file.template);
    }
  }

  // Commit any untracked changes
  if (await hasUntrackedFiles(workingDir)) {
    await commitChanges(workingDir, 'Changes since last startup');
  }
}
