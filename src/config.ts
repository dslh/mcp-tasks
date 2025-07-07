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