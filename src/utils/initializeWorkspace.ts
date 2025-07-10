import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getWorkingDirectory } from 'src/config';
import { isGitRepo, initGitRepo, hasUntrackedFiles, commitChanges } from './git';

const CURRENT_TEMPLATE = `# Last Week

# This Week

# Next Week
`;

const BACKLOG_TEMPLATE = `# Backlog
`;

const ARCHIVE_TEMPLATE = `# Archive
`;

export async function initializeWorkspace(): Promise<void> {
  const workingDir = getWorkingDirectory();

  // Create directory if it doesn't exist
  if (!existsSync(workingDir)) {
    mkdirSync(workingDir, { recursive: true });
  }

  // Initialize git repository if it doesn't exist
  if (!(await isGitRepo())) {
    await initGitRepo();
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
  if (await hasUntrackedFiles()) {
    await commitChanges('Changes since last startup');
  }
}
