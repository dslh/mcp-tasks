import { readFileSync, writeFileSync } from 'fs';
import { z } from 'zod';
import { getFilePath } from '../config.js';
import { validateTaskMatch, type TaskMatch } from '../utils/taskIdentifier.js';
import { removeTask, addTaskToSection, getCurrentDate } from '../utils/markdown.js';
import { commitChanges } from '../utils/git.js';

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
  const sourceFilePath = getFilePath(task.file);
  const content = readFileSync(sourceFilePath, 'utf-8');
  const lines = content.split('\n');

  const descriptionLines: string[] = [];

  // Look for description lines after the task line
  for (let i = task.lineNumber; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('  ') && line.trim() !== '') {
      // Remove the indentation to get the original description text
      descriptionLines.push(line.substring(2));
    } else {
      // Hit empty line, next task, or section - stop
      break;
    }
  }

  return descriptionLines.length > 0 ? descriptionLines.join('\n') : undefined;
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
  const sourceFilePath = getFilePath(task.file);
  const content = readFileSync(sourceFilePath, 'utf-8');
  const updatedContent = removeTask(content, task.lineNumber);

  writeFileSync(sourceFilePath, updatedContent);
}

function addTaskToDestination(
  destination: MoveDestination,
  taskText: string,
  description?: string,
): void {
  const destFilePath = getFilePath(destination.file);
  const content = readFileSync(destFilePath, 'utf-8');
  const updatedContent = addTaskToSection(content, destination.section, taskText, description);

  writeFileSync(destFilePath, updatedContent);
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
  addTaskToDestination(destinationInfo, transformedText, description);

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
