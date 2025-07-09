import { getTaskDescriptionLines } from './parsing';

export function removeTask(content: string, lineNumber: number): string {
  const lines = content.split('\n');
  const taskLine = lines[lineNumber - 1]; // Convert to 0-based index

  if (!taskLine) {
    throw new Error(`Line ${lineNumber} not found in content`);
  }

  // Verify it's actually a task line
  if (!taskLine.match(/^- \[[ x-]\] /)) {
    throw new Error(`No task found at line ${lineNumber}`);
  }

  // Find the extent of the task (including description lines)
  const descriptionLines = getTaskDescriptionLines(lines, lineNumber);
  const endLine = lineNumber - 1 + descriptionLines.length;

  // Remove the task and its description lines
  const newLines = [
    ...lines.slice(0, lineNumber - 1), // Everything before task (0-based)
    ...lines.slice(endLine + 1), // Everything after task and description
  ];

  return newLines.join('\n');
}