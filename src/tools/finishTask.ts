import { z } from 'zod';
import { validateTaskMatch, type TaskMatch } from '../utils/taskIdentifier';
import { updateTaskStatus } from '../utils/markdown';
import { commitChanges } from '../utils/git';
import { changeFile } from '../utils/fileOperations';

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
  if (status === 'completed' && task.isCompleted) {
    return `Task "${task.taskText}" is already marked as completed`;
  }

  if (status === 'closed' && task.isClosed) {
    return `Task "${task.taskText}" is already marked as closed`;
  }

  return null;
}

function formatStatusMessage(taskText: string, status: 'completed' | 'closed'): string {
  const statusText = status === 'completed' ? 'completed' : 'closed';
  const statusIcon = status === 'completed' ? '[x]' : '[-]';

  return `Successfully marked task "${taskText}" as ${statusText} ${statusIcon}`;
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
      return {
        content: [{
          type: 'text' as const,
          text: alreadyInStateMessage,
        }],
      };
    }

    updateTaskInFile(task.file, task.lineNumber, status);

    const commitMessage = `${status === 'completed' ? 'Completed' : 'Closed'} task: ${task.taskText}`;

    await commitChanges(commitMessage);

    return {
      content: [{
        type: 'text' as const,
        text: formatStatusMessage(task.taskText, status),
      }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      content: [{
        type: 'text' as const,
        text: `Error finishing task: ${errorMessage}`,
      }],
      isError: true,
    };
  }
}
