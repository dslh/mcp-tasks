import { readFileSync, writeFileSync } from 'fs';
import { z } from 'zod';
import { getFilePath } from '../config.js';
import { validateTaskMatch, type TaskMatch } from '../utils/taskIdentifier.js';
import { updateTaskText, updateTaskDescription, getCurrentDate } from '../utils/markdown.js';
import { commitChanges } from '../utils/git.js';

export const name = 'edit_task';

export const config = {
  title: 'Edit Task',
  description: 'Modify an existing task\'s text or description',
  inputSchema: {
    task_identifier: z.string().describe('Text to match against existing tasks'),
    new_text: z.string().optional().describe('Updated task text'),
    new_description: z.string().optional().describe('Updated description'),
  },
};

function validateEditParameters(newText?: string, newDescription?: string): void {
  if ((newText === undefined || newText === '') && newDescription === undefined) {
    throw new Error('At least one of new_text or new_description must be provided');
  }
}

function updateBacklogTaskText(originalText: string, newText: string): string {
  // For backlog tasks, preserve the date suffix if it exists
  const dateMatch = originalText.match(/^(.+) added on (\d{4}-\d{2}-\d{2})$/);

  if (dateMatch) {
    const [, , date] = dateMatch;

    return `${newText} added on ${date}`;
  }

  // If no date found, add current date (shouldn't happen but be safe)
  return `${newText} added on ${getCurrentDate()}`;
}

function updateTaskInFile(
  fileName: 'current' | 'backlog',
  task: TaskMatch,
  newText?: string,
  newDescription?: string,
): void {
  const filePath = getFilePath(fileName);
  let content = readFileSync(filePath, 'utf-8');

  // Update task text if provided
  if (newText !== undefined && newText !== '') {
    const finalText = fileName === 'backlog'
      ? updateBacklogTaskText(task.taskText, newText)
      : newText;

    content = updateTaskText(content, task.lineNumber, finalText);
  }

  // Update description if provided (or explicitly cleared)
  if (newDescription !== undefined) {
    content = updateTaskDescription(
      content,
      task.lineNumber,
      newDescription || null,
    );
  }

  writeFileSync(filePath, content);
}

function formatUpdateMessage(newText?: string, newDescription?: string): string {
  const updates: string[] = [];

  if (newText !== undefined && newText !== '') {
    updates.push('text');
  }

  if (newDescription !== undefined) {
    updates.push(newDescription !== '' ? 'description' : 'description (cleared)');
  }

  return `Updated ${updates.join(' and ')}`;
}

export async function handler({
  task_identifier,
  new_text,
  new_description,
}: {
  task_identifier: string;
  new_text?: string;
  new_description?: string;
}) {
  try {
    validateEditParameters(new_text, new_description);

    const task = validateTaskMatch(task_identifier);

    updateTaskInFile(task.file, task, new_text, new_description);

    const updateMessage = formatUpdateMessage(new_text, new_description);
    const commitMessage = `Edited task: ${task.taskText} - ${updateMessage}`;

    await commitChanges(commitMessage);

    return {
      content: [{
        type: 'text' as const,
        text: `Successfully updated task "${task.taskText}" - ${updateMessage}`,
      }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      content: [{
        type: 'text' as const,
        text: `Error editing task: ${errorMessage}`,
      }],
      isError: true,
    };
  }
}
