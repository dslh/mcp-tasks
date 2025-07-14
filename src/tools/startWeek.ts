import { parseMarkdownSections, getTaskDescriptionLines } from '../utils/markdown';
import { readFile, changeFile, appendToFile } from '../utils/fileOperations';
import { hasUntrackedFiles, commitChanges } from '../utils/git';
import { getCurrentDate, getArchiveWeekDate } from '../utils/dates';
import { createSuccessResponse, createErrorResponse } from '../utils/responses';
import { parseStatusChar, isFinishedStatus } from '../utils/taskStatus';

export const name = 'start_week';

export const config = {
  title: 'Start Week',
  description: 'Execute the weekly transition: archive current week, move incomplete tasks and next week to current week',
  inputSchema: {},
};

function filterTasksByCompletion(sectionContent: string[]): { finished: string[]; unfinished: string[] } {
  const finished: string[] = [];
  const unfinished: string[] = [];

  for (let i = 0; i < sectionContent.length; i++) {
    const line = sectionContent[i];

    // Check if this is a task line
    const taskMatch = line.match(/^- \[([ x-])\] /);

    if (taskMatch) {
      const statusChar = taskMatch[1];
      const status = parseStatusChar(statusChar);
      const isFinished = isFinishedStatus(status);

      // Collect this task and any description lines that follow
      const taskLines = [line];
      const descriptionLines = getTaskDescriptionLines(sectionContent, i + 1);

      taskLines.push(...descriptionLines);
      i += descriptionLines.length; // Skip these lines in the main loop

      if (isFinished) {
        finished.push(...taskLines);
      } else {
        unfinished.push(...taskLines);
      }
    }
  }

  return { finished, unfinished };
}

function checkIfWeekAlreadyArchived(archiveDate: string): boolean {
  try {
    const archiveContent = readFile('archive');
    const sections = parseMarkdownSections(archiveContent);
    const expectedTitle = `Week of ${archiveDate}`;

    return sections.some(section => section.title === expectedTitle);
  } catch {
    // If archive file doesn't exist or can't be read, assume not archived
    return false;
  }
}

function addWeekToArchive(archiveDate: string, thisWeekContent: string[]): void {
  const sectionTitle = `Week of ${archiveDate}`;
  const newSection = [`# ${sectionTitle}`, ...thisWeekContent].join('\n');

  appendToFile('archive', newSection);
}

function formatThisWeekSection(): string {
  try {
    const currentContent = readFile('current');
    const sections = parseMarkdownSections(currentContent);
    const thisWeekSection = sections.find(s => s.title === 'This Week');

    if (!thisWeekSection) {
      return '';
    }

    return ['# This Week', ...thisWeekSection.content].join('\n');
  } catch {
    // If current file can't be read, return empty string
    return '';
  }
}

function rebuildCurrentFile(
  newThisWeekTasks: string[],
): void {
  changeFile('current', () => {
    const sections = [
      '# This Week',
      ...newThisWeekTasks,
      '',
      '# Next Week',
      '',
    ];

    return sections.join('\n');
  });
}

async function performWeekTransition(): Promise<string> {
  // Step 1: Check if week already archived (idempotency check)
  const archiveDate = getArchiveWeekDate();

  if (checkIfWeekAlreadyArchived(archiveDate)) {
    const currentThisWeek = formatThisWeekSection();
    const message = `Week of ${archiveDate} has already been archived. No changes made.`;

    return currentThisWeek ? `${message}\n\n${currentThisWeek}` : message;
  }

  // Step 2: Pre-backup commit
  if (await hasUntrackedFiles()) {
    await commitChanges('Pre-start-week backup');
  }

  // Step 3: Parse current.md
  const currentContent = readFile('current');
  const sections = parseMarkdownSections(currentContent);

  const thisWeekSection = sections.find(s => s.title === 'This Week');
  const nextWeekSection = sections.find(s => s.title === 'Next Week');

  if (!thisWeekSection || !nextWeekSection) {
    throw new Error('Required sections not found in current.md');
  }

  // Step 4: Copy "This Week" to archive (entire section for record keeping)
  addWeekToArchive(archiveDate, thisWeekSection.content);

  // Step 5: Filter "This Week" tasks by completion
  const { unfinished: thisWeekUnfinished } =
    filterTasksByCompletion(thisWeekSection.content);

  // Step 6: Combine incomplete tasks with next week tasks for new "This Week"
  const newThisWeekTasks = [...thisWeekUnfinished, ...nextWeekSection.content];

  // Step 7: Rebuild current.md
  rebuildCurrentFile(newThisWeekTasks);

  // Step 8: Final commit
  const today = getCurrentDate();

  await commitChanges(`Completed week transition to ${today}`);

  const currentThisWeek = formatThisWeekSection();
  const message = `Successfully completed week transition. Archived week of ${archiveDate}.`;

  return currentThisWeek ? `${message}\n\n${currentThisWeek}` : message;
}

export async function handler() {
  try {
    const successMessage = await performWeekTransition();

    return createSuccessResponse(successMessage);
  } catch (error) {
    return createErrorResponse('during week transition', error);
  }
}
