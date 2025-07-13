import { readFile } from '../utils/fileOperations';
import { createSuccessResponse, createErrorResponse } from '../utils/responses';

export const name = 'get_task_backlog';

export const config = {
  title: 'Get Task Backlog',
  description: 'Retrieve the backlog of as-yet unscheduled tasks',
  inputSchema: {},
};

export function handler() {
  try {
    const content = readFile('backlog');

    return createSuccessResponse(content);
  } catch (error) {
    return createErrorResponse('reading task backlog', error);
  }
}
