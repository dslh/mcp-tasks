import { readFileSync } from 'fs';
import { getFilePath } from '../config.js';

export const name = 'get_current_tasks';

export const config = {
  title: 'Get Current Tasks',
  description: 'Retrieve all current, recent, and upcoming tasks',
  inputSchema: {},
};

export function handler() {
  try {
    const filePath = getFilePath('current');
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
