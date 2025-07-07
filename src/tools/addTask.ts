import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { getWorkingDirectory } from '../config.js';
import { addTaskToSection, getCurrentDate } from '../utils/markdown.js';
import { commitChanges } from '../utils/git.js';

export const name = 'add_task';

export const config = {
  title: 'Add Task',
  description: 'Add a new task to the system',
  inputSchema: {
    task_text: z.string().describe('The task description'),
    target: z.enum(['backlog', 'current_week', 'next_week']).describe('Where to add the task'),
    description: z.string().optional().describe('Additional task details'),
  },
};

export async function handler({ 
  task_text, 
  target, 
  description,
}: {
  task_text: string;
  target: 'backlog' | 'current_week' | 'next_week';
  description?: string;
}) {
  try {
    const workingDir = getWorkingDirectory();
    
    // Determine target file and section
    let filePath: string;
    let sectionTitle: string;
    let taskTextWithDate = task_text;

    if (target === 'backlog') {
      filePath = join(workingDir, 'backlog.md');
      sectionTitle = 'Backlog';
      // Add current date to task text for backlog items
      taskTextWithDate = `${task_text} added on ${getCurrentDate()}`;
    } else {
      filePath = join(workingDir, 'current.md');
      sectionTitle = target === 'current_week' ? 'This Week' : 'Next Week';
    }

    // Read current file content
    const currentContent = readFileSync(filePath, 'utf-8');
    
    // Add the task to the appropriate section
    const updatedContent = addTaskToSection(
      currentContent,
      sectionTitle,
      taskTextWithDate,
      description,
    );
    
    // Write the updated content back to file
    writeFileSync(filePath, updatedContent);
    
    // Commit the changes
    const commitMessage = `Added task: ${task_text}`;
    await commitChanges(commitMessage);
    
    return {
      content: [{
        type: 'text' as const,
        text: `Successfully added task "${task_text}" to ${sectionTitle}`,
      }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      content: [{
        type: 'text' as const,
        text: `Error adding task: ${errorMessage}`,
      }],
      isError: true,
    };
  }
}