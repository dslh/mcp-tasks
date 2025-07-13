import { readFileSync, writeFileSync } from 'fs';
import { getFilePath } from '../config';
import { addTaskToSection } from './markdown';
import type { TaskStatus } from './taskStatus';

// eslint-disable-next-line no-unused-vars
type ContentModifier = (content: string) => string;

export function readFile(fileName: 'current' | 'backlog' | 'archive'): string {
  const filePath = getFilePath(fileName);

  return readFileSync(filePath, 'utf-8');
}

export function changeFile(
  fileName: 'current' | 'backlog' | 'archive',
  modifier: ContentModifier,
): void {
  const filePath = getFilePath(fileName);
  const content = readFileSync(filePath, 'utf-8');
  const updatedContent = modifier(content);

  writeFileSync(filePath, updatedContent);
}

export function appendToFile(
  fileName: 'current' | 'backlog' | 'archive',
  content: string,
): void {
  changeFile(fileName, (existingContent) => {
    const trimmed = existingContent.trim();

    return trimmed ? `${trimmed}\n\n${content}` : content;
  });
}

export function addTaskToFile(
  fileName: 'current' | 'backlog' | 'archive',
  sectionTitle: string,
  taskText: string,
  description?: string,
  status: TaskStatus = 'new',
): void {
  changeFile(fileName, (content) =>
    addTaskToSection(content, sectionTitle, taskText, description, status),
  );
}
