import { readFile } from 'src/utils/fileOperations';

export const name = 'get_current_tasks';

export const config = {
  title: 'Get Current Tasks',
  description: 'Retrieve all current, recent, and upcoming tasks',
  inputSchema: {},
};

export function handler() {
  try {
    const content = readFile('current');

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
