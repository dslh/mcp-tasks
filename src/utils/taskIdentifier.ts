import { parseMarkdownSections } from './markdown';
import { readFile } from './fileOperations';

export interface TaskMatch {
  file: 'current' | 'backlog';
  section: string;
  taskText: string;
  lineNumber: number;
  isCompleted: boolean;
  isClosed: boolean;
}

function parseTaskLine(line: string): { taskText: string; isCompleted: boolean; isClosed: boolean } | null {
  const taskMatch = line.match(/^- \[([ x-])\] (.+)$/);

  if (!taskMatch) {
    return null;
  }

  const [, status, taskText] = taskMatch;

  return {
    taskText: taskText.trim(),
    isCompleted: status === 'x',
    isClosed: status === '-',
  };
}

function findTasksInFile(fileName: 'current' | 'backlog'): TaskMatch[] {
  const content = readFile(fileName);
  const sections = parseMarkdownSections(content);
  const tasks: TaskMatch[] = [];

  for (const section of sections) {
    let lineNumber = section.startLine + 1; // +1 to skip section header

    for (const line of section.content) {
      lineNumber++;
      const taskInfo = parseTaskLine(line);

      if (taskInfo) {
        tasks.push({
          file: fileName,
          section: section.title,
          taskText: taskInfo.taskText,
          lineNumber,
          isCompleted: taskInfo.isCompleted,
          isClosed: taskInfo.isClosed,
        });
      }
    }
  }

  return tasks;
}

export function findAllTasks(): TaskMatch[] {
  const currentTasks = findTasksInFile('current');
  const backlogTasks = findTasksInFile('backlog');

  return [...currentTasks, ...backlogTasks];
}

export function findMatchingTasks(identifier: string): TaskMatch[] {
  if (!identifier.trim()) {
    throw new Error('Task identifier cannot be empty');
  }

  const allTasks = findAllTasks();
  const lowerIdentifier = identifier.toLowerCase();

  // Case-insensitive substring matching
  const matches = allTasks.filter(task =>
    task.taskText.toLowerCase().includes(lowerIdentifier),
  );

  return matches;
}

export function validateTaskMatch(identifier: string): TaskMatch {
  const matches = findMatchingTasks(identifier);

  if (matches.length === 0) {
    // Get similar tasks for suggestions
    const allTasks = findAllTasks();
    const suggestions = allTasks
      .map(task => task.taskText)
      .slice(0, 3) // Show max 3 suggestions
      .map(text => `"${text}"`)
      .join(', ');

    throw new Error(
      `No matching tasks found for "${identifier}". ${
        suggestions ? `Did you mean: ${suggestions}?` : 'No tasks available.'
      }`,
    );
  }

  if (matches.length > 1) {
    const matchList = matches
      .map(match => `"${match.taskText}" (in ${match.section})`)
      .join(', ');

    throw new Error(
      `Multiple matches found for "${identifier}": ${matchList}. Please be more specific.`,
    );
  }

  return matches[0];
}
