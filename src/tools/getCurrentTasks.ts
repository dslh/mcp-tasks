import { readFileSync } from 'fs';
import { join } from 'path';
import { getWorkingDirectory } from '../config.js';

export const name = 'get_current_tasks';

export const config = {
  title: 'Get Current Tasks',
  description: 'Retrieve all current, recent, and upcoming tasks',
  inputSchema: {},
};

export function handler() {
  try {
    const workingDir = getWorkingDirectory();
    const filePath = join(workingDir, 'current.md');
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
        text: `Error reading current task list: ${errorMessage}`,
      }],
      isError: true,
    };
  }
}
