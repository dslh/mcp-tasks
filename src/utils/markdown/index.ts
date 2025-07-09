// Re-export all functions and types for backward compatibility
export type { TaskSection } from './parsing';
export { parseMarkdownSections, getTaskDescriptionLines } from './parsing';
export { addTaskToSection } from './addTask';
export { updateTaskStatus, updateTaskText, updateTaskDescription } from './updateTask';
export { removeTask } from './removeTask';
