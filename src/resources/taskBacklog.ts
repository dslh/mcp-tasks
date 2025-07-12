import { readFile } from '../utils/fileOperations';

export const name = 'task-backlog';

export const uri = 'file:///backlog.md';

export const metadata = {
  title: 'Task Backlog',
  description: 'Backlog of future tasks with creation dates',
};

export function handler() {
  try {
    const content = readFile('backlog');

    return {
      contents: [{
        uri: 'file:///backlog.md',
        mimeType: 'text/markdown',
        text: content,
      }],
    };
  } catch (error) {
    throw new Error(`Failed to read backlog.md: ${error instanceof Error ? error.message : String(error)}`);
  }
}
