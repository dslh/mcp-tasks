interface TaskSection {
  title: string;
  content: string[];
  startLine: number;
  endLine: number;
}

export function parseMarkdownSections(content: string): TaskSection[] {
  const lines = content.split('\n');
  const sections: TaskSection[] = [];
  let currentSection: TaskSection | null = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];

    if (line.startsWith('# ')) {
      // Save previous section if it exists
      if (currentSection !== null) {
        currentSection.endLine = index - 1;
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        title: line.substring(2).trim(),
        content: [],
        startLine: index,
        endLine: -1,
      };
    } else if (currentSection !== null) {
      currentSection.content.push(line);
    }
  }

  // Add the last section
  if (currentSection !== null) {
    currentSection.endLine = lines.length - 1;
    sections.push(currentSection);
  }

  return sections;
}

export function addTaskToSection(
  content: string,
  sectionTitle: string,
  taskText: string,
  description?: string,
): string {
  const sections = parseMarkdownSections(content);
  const targetSection = sections.find(section =>
    section.title.toLowerCase() === sectionTitle.toLowerCase(),
  );

  if (!targetSection) {
    throw new Error(`Section "${sectionTitle}" not found`);
  }

  // Create the new task lines
  const taskLines = [`- [ ] ${taskText}`];

  if (description !== undefined && description !== '') {
    const descriptionLines = description.split('\n').map((line: string) => `  ${line}`);

    taskLines.push(...descriptionLines);
  }

  // Add task to the end of the section content
  const updatedContent = [...targetSection.content];

  // Remove any trailing empty lines and add the task
  while (updatedContent.length > 0 && updatedContent[updatedContent.length - 1].trim() === '') {
    updatedContent.pop();
  }

  // Add task lines with one empty line at the end
  updatedContent.push(...taskLines, '');

  // Rebuild the full content
  const lines = content.split('\n');
  const newLines = [
    ...lines.slice(0, targetSection.startLine + 1),
    ...updatedContent,
    ...lines.slice(targetSection.endLine + 1),
  ];

  return newLines.join('\n');
}

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
  const statusChar = newStatus === 'completed' ? 'x' : '-';
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

export function getTaskDescriptionLines(lines: string[], startIndex: number): string[] {
  const descriptionLines: string[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('  ') && line.trim() !== '') {
      descriptionLines.push(line);
    } else {
      break;
    }
  }

  return descriptionLines;
}

export function getCurrentDate(): string {
  const now = new Date();

  return now.toISOString().split('T')[0];
}
