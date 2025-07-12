import { parseMarkdownSections } from './parsing';
import { type TaskStatus } from '../taskIdentifier';

function getTaskCheckbox(status: TaskStatus): string {
  switch (status) {
    case 'completed':
      return '- [x]';
    case 'closed':
      return '- [-]';
    default:
      return '- [ ]';
  }
}

export function addTaskToSection(
  content: string,
  sectionTitle: string,
  taskText: string,
  description?: string,
  status: TaskStatus = 'new',
): string {
  const sections = parseMarkdownSections(content);
  const targetSection = sections.find(section =>
    section.title.toLowerCase() === sectionTitle.toLowerCase(),
  );

  if (!targetSection) {
    throw new Error(`Section "${sectionTitle}" not found`);
  }

  // Create the new task lines
  const taskLines = [`${getTaskCheckbox(status)} ${taskText}`];

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