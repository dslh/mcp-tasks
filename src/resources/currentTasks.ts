import { readFile } from '../utils/fileOperations';

export const name = 'current-tasks';

export const uri = 'file:///current.md';

export const metadata = {
  title: 'Current Tasks',
  description: 'Current weekly task management file with Last Week, This Week, and Next Week sections',
};

export function handler() {
  try {
    const content = readFile('current');

    return {
      contents: [{
        uri: 'file:///current.md',
        mimeType: 'text/markdown',
        text: content,
      }],
    };
  } catch (error) {
    throw new Error(`Failed to read current.md: ${error instanceof Error ? error.message : String(error)}`);
  }
}
