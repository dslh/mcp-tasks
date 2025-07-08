import { readFileSync } from 'fs';
import { getFilePath } from '../config.js';

export const name = 'get_task_backlog';

export const config = {
  title: 'Get Task Backlog',
  description: 'Retrieve the backlog of as-yet unscheduled tasks',
  inputSchema: {},
};

export function handler() {
  try {
    const filePath = getFilePath('backlog');
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
        text: `Error reading task backlog: ${errorMessage}`,
      }],
      isError: true,
    };
  }
}
