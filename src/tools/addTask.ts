import { z } from 'zod';
import { getCurrentDate } from '../utils/dates';
import { commitChanges } from '../utils/git';
import { addTaskToFile } from '../utils/fileOperations';
import { createSuccessResponse, createErrorResponse } from '../utils/responses';

export const name = 'add_task';

export const config = {
  title: 'Add Task',
  description: 'Add a new task to the system',
  inputSchema: {
    task_text: z.string().describe('The task description'),
    target: z.enum(['backlog', 'current_week', 'next_week']).describe('Where to add the task'),
    description: z.string().optional().describe('Additional task details'),
  },
};

interface TaskTarget {
  fileName: 'current' | 'backlog';
  sectionTitle: string;
  taskText: string;
}

function determineTaskTarget(
  target: 'backlog' | 'current_week' | 'next_week',
  taskText: string,
): TaskTarget {
  if (target === 'backlog') {
    return {
      fileName: 'backlog',
      sectionTitle: 'Backlog',
      taskText: `${taskText} added on ${getCurrentDate()}`,
    };
  }

  return {
    fileName: 'current',
    sectionTitle: target === 'current_week' ? 'This Week' : 'Next Week',
    taskText,
  };
}

export async function handler({
  task_text,
  target,
  description,
}: {
  task_text: string;
  target: 'backlog' | 'current_week' | 'next_week';
  description?: string;
}) {
  try {
    const taskTarget = determineTaskTarget(target, task_text);

    addTaskToFile(
      taskTarget.fileName,
      taskTarget.sectionTitle,
      taskTarget.taskText,
      description,
    );

    await commitChanges(`Added task: ${task_text}`);

    return createSuccessResponse(`Successfully added task "${task_text}" to ${taskTarget.sectionTitle}`);
  } catch (error) {
    return createErrorResponse('adding task', error);
  }
}
