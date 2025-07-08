import { parseMarkdownSections } from '../utils/markdown.js';
import { readFile, changeFile } from '../utils/fileOperations.js';
import { commitChanges } from '../utils/git.js';

export const name = 'start_week';

export const config = {
  title: 'Start Week',
  description: 'Execute the weekly transition workflow',
  inputSchema: {},
};

function getArchiveWeekDate(): string {
  const today = new Date();

  // Find last Thursday
  const lastThursday = new Date(today);
  const currentDay = today.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const daysToSubtract = currentDay >= 4 ? currentDay - 4 : currentDay + 3; // Days back to Thursday

  lastThursday.setDate(today.getDate() - daysToSubtract);

  // Subtract 10 days to get Monday of the week to archive
  const archiveMonday = new Date(lastThursday);

  archiveMonday.setDate(lastThursday.getDate() - 10);

  // Format as YYYY-MM-DD
  const year = archiveMonday.getFullYear();
  const month = String(archiveMonday.getMonth() + 1).padStart(2, '0');
  const day = String(archiveMonday.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function filterTasksByCompletion(sectionContent: string[]): { finished: string[]; unfinished: string[] } {
  const finished: string[] = [];
  const unfinished: string[] = [];

  for (let i = 0; i < sectionContent.length; i++) {
    const line = sectionContent[i];

    // Check if this is a task line
    const taskMatch = line.match(/^- \[([ x-])\] /);

    if (taskMatch) {
      const status = taskMatch[1];
      const isFinished = status === 'x' || status === '-';

      // Collect this task and any description lines that follow
      const taskLines = [line];

      // Look for description lines (indented lines immediately following)
      for (let j = i + 1; j < sectionContent.length; j++) {
        const nextLine = sectionContent[j];

        if (nextLine.startsWith('  ') && nextLine.trim() !== '') {
          taskLines.push(nextLine);
          i = j; // Skip these lines in the main loop
        } else {
          break;
        }
      }

      if (isFinished) {
        finished.push(...taskLines);
      } else {
        unfinished.push(...taskLines);
      }
    } else if (line.trim() === '') {
      // Preserve empty lines in both arrays for now, we'll clean up later
      // For now, add to unfinished to maintain structure
      if (unfinished.length > 0) {
        unfinished.push(line);
      }
    }
  }

  return { finished, unfinished };
}

function addWeekToArchive(archiveDate: string, lastWeekContent: string[]): void {
  const sectionTitle = `Week of ${archiveDate}`;

  changeFile('archive', (content) => {
    const sections = parseMarkdownSections(content);

    // Create new section content
    const newSectionLines = [`# ${sectionTitle}`, ...lastWeekContent, ''];

    // If archive is empty or only has header, add as first section
    if (sections.length === 0) {
      return newSectionLines.join('\n');
    }

    // Add the new section at the top (most recent first)
    const lines = content.split('\n');
    const firstSectionStart = sections[0].startLine;

    const newContent = [
      ...lines.slice(0, firstSectionStart),
      ...newSectionLines,
      ...lines.slice(firstSectionStart),
    ];

    return newContent.join('\n');
  });
}

function rebuildCurrentFile(
  lastWeekFinished: string[],
  thisWeekUnfinished: string[],
  nextWeekTasks: string[],
): void {
  changeFile('current', () => {
    const sections = [
      '# Last Week',
      ...lastWeekFinished,
      '',
      '# This Week',
      ...thisWeekUnfinished,
      ...nextWeekTasks,
      '',
      '# Next Week',
      '',
    ];

    return sections.join('\n');
  });
}

async function performWeekTransition(): Promise<string> {
  // Step 1: Pre-backup commit
  await commitChanges('Pre-start-week backup');

  // Step 2: Parse current.md
  const currentContent = readFile('current');
  const sections = parseMarkdownSections(currentContent);

  const lastWeekSection = sections.find(s => s.title === 'Last Week');
  const thisWeekSection = sections.find(s => s.title === 'This Week');
  const nextWeekSection = sections.find(s => s.title === 'Next Week');

  if (!lastWeekSection || !thisWeekSection || !nextWeekSection) {
    throw new Error('Required sections not found in current.md');
  }

  // Step 3: Move "Last Week" to archive
  const archiveDate = getArchiveWeekDate();

  addWeekToArchive(archiveDate, lastWeekSection.content);

  // Step 4: Filter "This Week" tasks by completion
  const { finished: thisWeekFinished, unfinished: thisWeekUnfinished } =
    filterTasksByCompletion(thisWeekSection.content);

  // Step 5: Rebuild current.md
  rebuildCurrentFile(
    thisWeekFinished,
    thisWeekUnfinished,
    nextWeekSection.content,
  );

  // Step 6: Final commit
  const today = new Date().toISOString().split('T')[0];

  await commitChanges(`Completed week transition to ${today}`);

  return `Successfully completed week transition. Archived week of ${archiveDate}.`;
}

export async function handler() {
  try {
    const successMessage = await performWeekTransition();

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
        text: `Error during week transition: ${errorMessage}`,
      }],
      isError: true,
    };
  }
}
