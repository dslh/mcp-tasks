import { readFile } from '../utils/fileOperations';
import { createSuccessResponse, createErrorResponse } from '../utils/responses';

export const name = 'get_current_tasks';

export const config = {
  title: 'Get Current Tasks',
  description: 'Retrieve all current, recent, and upcoming tasks',
  inputSchema: {},
};

export function handler() {
  try {
    const content = readFile('current');

    return createSuccessResponse(content);
  } catch (error) {
    return createErrorResponse('reading current task list', error);
  }
}
