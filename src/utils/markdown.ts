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

  if (description !== null) {
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

export function getCurrentDate(): string {
  const now = new Date();

  return now.toISOString().split('T')[0];
}
