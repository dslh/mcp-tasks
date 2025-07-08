import { join } from 'path';

let workingDirectory: string | null = null;

export function setWorkingDirectory(dir: string): void {
  workingDirectory = dir;
}

export function getWorkingDirectory(): string {
  if (!workingDirectory) {
    throw new Error('Working directory not set. Call setWorkingDirectory() first.');
  }

  return workingDirectory;
}

export function getFilePath(fileName: 'current' | 'backlog' | 'archive'): string {
  const workingDir = getWorkingDirectory();

  switch (fileName) {
    case 'current':
      return join(workingDir, 'current.md');
    case 'backlog':
      return join(workingDir, 'backlog.md');
    case 'archive':
      return join(workingDir, 'archive.md');
    default:
      throw new Error(`Unknown file: ${fileName}`);
  }
}
