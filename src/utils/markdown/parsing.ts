export interface TaskSection {
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