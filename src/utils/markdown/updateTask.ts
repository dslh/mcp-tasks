import { getTaskDescriptionLines } from './parsing';
import { getStatusChar } from '../taskStatus';

export function updateTaskStatus(
  content: string,
  lineNumber: number,
  newStatus: 'completed' | 'closed',
): string {
  const lines = content.split('\n');
  const targetLine = lines[lineNumber - 1]; // Convert to 0-based index

  if (!targetLine) {
    throw new Error(`Line ${lineNumber} not found in content`);
  }

  // Replace the status in the checkbox
  const statusChar = getStatusChar(newStatus);
  const updatedLine = targetLine.replace(/^- \[[ x-]\]/, `- [${statusChar}]`);

  if (updatedLine === targetLine) {
    throw new Error(`No task found at line ${lineNumber}`);
  }

  lines[lineNumber - 1] = updatedLine;

  return lines.join('\n');
}

export function updateTaskText(
  content: string,
  lineNumber: number,
  newText: string,
): string {
  const lines = content.split('\n');
  const targetLine = lines[lineNumber - 1]; // Convert to 0-based index

  if (!targetLine) {
    throw new Error(`Line ${lineNumber} not found in content`);
  }

  // Extract the current status and replace the text
  const taskMatch = targetLine.match(/^- \[([ x-])\] (.+)$/);

  if (!taskMatch) {
    throw new Error(`No task found at line ${lineNumber}`);
  }

  const [, status] = taskMatch;
  const updatedLine = `- [${status}] ${newText}`;

  lines[lineNumber - 1] = updatedLine;

  return lines.join('\n');
}

export function updateTaskDescription(
  content: string,
  taskLineNumber: number,
  newDescription: string | null,
): string {
  const lines = content.split('\n');
  const taskLine = lines[taskLineNumber - 1]; // Convert to 0-based index

  if (!taskLine) {
    throw new Error(`Line ${taskLineNumber} not found in content`);
  }

  // Find description lines using helper function
  const descriptionLines = getTaskDescriptionLines(lines, taskLineNumber);
  const endLine = taskLineNumber - 1 + descriptionLines.length;

  // Remove old description lines (everything after the task line up to endLine)
  const newLines = [
    ...lines.slice(0, taskLineNumber), // Everything before task
    ...lines.slice(endLine + 1), // Everything after old description
  ];

  // Add new description if provided
  if (newDescription !== null && newDescription.trim() !== '') {
    const descriptionLines = newDescription.split('\n').map((line: string) => `  ${line}`);

    newLines.splice(taskLineNumber, 0, ...descriptionLines);
  }

  return newLines.join('\n');
}
