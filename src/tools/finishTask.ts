import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { getWorkingDirectory } from '../config.js';
import { validateTaskMatch, type TaskMatch } from '../utils/taskIdentifier.js';
import { updateTaskStatus } from '../utils/markdown.js';
import { commitChanges } from '../utils/git.js';

export const name = 'finish_task';

export const config = {
  title: 'Finish Task',
  description: 'Mark a task as completed or closed',
  inputSchema: {
    task_identifier: z.string().describe('Text to match against existing tasks'),
    status: z.enum(['completed', 'closed']).describe('Mark as completed (x) or closed (-)'),
  },
};

function getFilePath(fileName: 'current' | 'backlog'): string {
  const workingDir = getWorkingDirectory();

  return fileName === 'current'
    ? join(workingDir, 'current.md')
    : join(workingDir, 'backlog.md');
}

function updateTaskInFile(
  fileName: 'current' | 'backlog',
  lineNumber: number,
  status: 'completed' | 'closed',
): void {
  const filePath = getFilePath(fileName);
  const content = readFileSync(filePath, 'utf-8');
  const updatedContent = updateTaskStatus(content, lineNumber, status);

  writeFileSync(filePath, updatedContent);
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
