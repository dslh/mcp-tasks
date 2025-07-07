import { readFileSync } from 'fs';
import { join } from 'path';
import { getWorkingDirectory } from '../config.js';

export const name = 'get_task_backlog';

export const config = {
  title: 'Get Task Backlog',
  description: 'Retrieve the entire backlog.md file contents',
  inputSchema: {},
};

export function handler() {
  try {
    const workingDir = getWorkingDirectory();
    const filePath = join(workingDir, 'backlog.md');
    const content = readFileSync(filePath, 'utf-8');

    return {
      content: [{
        type: 'text' as const,
        text: content,
      }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      content: [{
        type: 'text' as const,
        text: `Error reading backlog.md: ${errorMessage}`,
      }],
      isError: true,
    };
  }
}
