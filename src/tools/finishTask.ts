import { z } from 'zod';
import { validateTaskMatch, type TaskMatch } from '../utils/taskIdentifier';
import { updateTaskStatus } from '../utils/markdown';
import { commitChanges } from '../utils/git';
import { changeFile } from '../utils/fileOperations';
import { createSuccessResponse, createErrorResponse } from '../utils/responses';
import { getStatusDisplay } from '../utils/taskStatus';

export const name = 'finish_task';

export const config = {
  title: 'Finish Task',
  description: 'Mark a task as completed or closed',
  inputSchema: {
    task_identifier: z.string().describe('Text to match against existing tasks'),
    status: z.enum(['completed', 'closed']).describe('Mark as completed (x) or closed (-)'),
  },
};

function updateTaskInFile(
  fileName: 'current' | 'backlog',
  lineNumber: number,
  status: 'completed' | 'closed',
): void {
  changeFile(fileName, (content) => updateTaskStatus(content, lineNumber, status));
}

function checkTaskAlreadyInState(
  task: TaskMatch,
  status: 'completed' | 'closed',
): string | null {
  if (task.status === status) {
    return `Task "${task.taskText}" is already marked as ${status}`;
  }

  return null;
}

function formatStatusMessage(taskText: string, status: 'completed' | 'closed'): string {
  const statusDisplay = getStatusDisplay(status);

  return `Successfully marked task "${taskText}" as ${statusDisplay}`;
}

export async function handler({
  task_identifier,
  status,
}: {
  task_identifier: string;
  status: 'completed' | 'closed';
}) {
  try {
    const task = validateTaskMatch(task_identifier);
    const alreadyInStateMessage = checkTaskAlreadyInState(task, status);

    if (alreadyInStateMessage !== null) {
      return createSuccessResponse(alreadyInStateMessage);
    }

    updateTaskInFile(task.file, task.lineNumber, status);

    const commitMessage = `${status === 'completed' ? 'Completed' : 'Closed'} task: ${task.taskText}`;

    await commitChanges(commitMessage);

    return createSuccessResponse(formatStatusMessage(task.taskText, status));
  } catch (error) {
    return createErrorResponse('finishing task', error);
  }
}
