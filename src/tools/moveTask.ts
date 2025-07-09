import { z } from 'zod';
import { validateTaskMatch, type TaskMatch } from '../utils/taskIdentifier.js';
import { removeTask, getTaskDescriptionLines } from '../utils/markdown.js';
import { getCurrentDate } from '../utils/dates.js';
import { commitChanges } from '../utils/git.js';
import { addTaskToFile, changeFile, readFile } from '../utils/fileOperations.js';

export const name = 'move_task';

export const config = {
  title: 'Move Task',
  description: 'Move a task between backlog, current week, and next week',
  inputSchema: {
    task_identifier: z.string().describe('Text to match against existing tasks'),
    destination: z.enum(['backlog', 'current_week', 'next_week']).describe('Where to move the task'),
  },
};

interface MoveDestination {
  file: 'current' | 'backlog';
  section: string;
}

function getDestinationInfo(destination: 'backlog' | 'current_week' | 'next_week'): MoveDestination {
  switch (destination) {
    case 'backlog':
      return { file: 'backlog', section: 'Backlog' };
    case 'current_week':
      return { file: 'current', section: 'This Week' };
    case 'next_week':
      return { file: 'current', section: 'Next Week' };
    default:
      throw new Error(`Unknown destination: ${destination}`);
  }
}

function extractTaskDescription(task: TaskMatch): string | undefined {
  // We need to read the source file and extract any description
  const content = readFile(task.file);
  const lines = content.split('\n');

  // Look for description lines after the task line
  const descriptionLines = getTaskDescriptionLines(lines, task.lineNumber);

  if (descriptionLines.length === 0) {
    return undefined;
  }

  // Remove the indentation to get the original description text
  return descriptionLines.map(line => line.substring(2)).join('\n');
}

function transformTaskText(
  taskText: string,
  fromDestination: 'backlog' | 'current_week' | 'next_week',
  toDestination: 'backlog' | 'current_week' | 'next_week',
): string {
  // Remove date from backlog tasks when moving to current/next week
  if (fromDestination === 'backlog' && toDestination !== 'backlog') {
    const dateMatch = taskText.match(/^(.+) added on \d{4}-\d{2}-\d{2}$/);

    if (dateMatch) {
      return dateMatch[1]; // Return text without date
    }
  }

  // Add date to tasks when moving to backlog
  if (fromDestination !== 'backlog' && toDestination === 'backlog') {
    return `${taskText} added on ${getCurrentDate()}`;
  }

  // No transformation needed for current_week <-> next_week moves
  return taskText;
}

function getSourceDestination(task: TaskMatch): 'backlog' | 'current_week' | 'next_week' {
  if (task.file === 'backlog') {
    return 'backlog';
  }

  if (task.section === 'This Week') {
    return 'current_week';
  }

  if (task.section === 'Next Week') {
    return 'next_week';
  }

  throw new Error(`Unknown source section: ${task.section}`);
}

function removeTaskFromSource(task: TaskMatch): void {
  changeFile(task.file, (content) => removeTask(content, task.lineNumber));
}

function checkTaskAlreadyAtDestination(
  task: TaskMatch,
  destination: 'backlog' | 'current_week' | 'next_week',
): string | null {
  const sourceDestination = getSourceDestination(task);

  if (sourceDestination === destination) {
    return `Task "${task.taskText}" is already in ${destination.replace('_', ' ')}`;
  }

  return null;
}

async function performTaskMove(
  task: TaskMatch,
  destination: 'backlog' | 'current_week' | 'next_week',
): Promise<string> {
  const sourceDestination = getSourceDestination(task);
  const destinationInfo = getDestinationInfo(destination);
  const description = extractTaskDescription(task);
  const transformedText = transformTaskText(task.taskText, sourceDestination, destination);

  // Remove from source
  removeTaskFromSource(task);

  // Add to destination
  addTaskToFile(destinationInfo.file, destinationInfo.section, transformedText, description);

  const sourceLocation = sourceDestination.replace('_', ' ');
  const destLocation = destination.replace('_', ' ');
  const commitMessage = `Moved task: ${task.taskText} from ${sourceLocation} to ${destLocation}`;

  await commitChanges(commitMessage);

  return `Successfully moved task "${task.taskText}" from ${sourceLocation} to ${destLocation}`;
}

export async function handler({
  task_identifier,
  destination,
}: {
  task_identifier: string;
  destination: 'backlog' | 'current_week' | 'next_week';
}) {
  try {
    const task = validateTaskMatch(task_identifier);
    const alreadyAtDestination = checkTaskAlreadyAtDestination(task, destination);

    if (alreadyAtDestination !== null) {
      return {
        content: [{
          type: 'text' as const,
          text: alreadyAtDestination,
        }],
      };
    }

    const successMessage = await performTaskMove(task, destination);

    return {
      content: [{
        type: 'text' as const,
        text: successMessage,
      }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      content: [{
        type: 'text' as const,
        text: `Error moving task: ${errorMessage}`,
      }],
      isError: true,
    };
  }
}
