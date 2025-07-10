import { parseMarkdownSections, getTaskDescriptionLines } from 'src/utils/markdown';
import { readFile, changeFile, appendToFile } from 'src/utils/fileOperations';
import { commitChanges } from 'src/utils/git';
import { getCurrentDate, getArchiveWeekDate } from 'src/utils/dates';

export const name = 'start_week';

export const config = {
  title: 'Start Week',
  description: 'Execute the weekly transition: archive last week, move current week to last week, next week to current week',
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
      const status = taskMatch[1];
      const isFinished = status === 'x' || status === '-';

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
  const newSection = [`# ${sectionTitle}`, ...lastWeekContent].join('\n');

  appendToFile('archive', newSection);
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
  const today = getCurrentDate();

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
