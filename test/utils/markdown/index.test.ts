import { describe, it, expect } from 'bun:test';

describe('markdown index re-exports', () => {
  it('should re-export all parsing functions', async () => {
    const markdownModule = await import('src/utils/markdown');

    expect(typeof markdownModule.parseMarkdownSections).toBe('function');
    expect(typeof markdownModule.getTaskDescriptionLines).toBe('function');
  });

  it('should re-export TaskSection type', async () => {
    const markdownModule = await import('src/utils/markdown');

    // Test that we can use the type by calling parseMarkdownSections
    const result = markdownModule.parseMarkdownSections('# Test\nContent');
    expect(Array.isArray(result)).toBe(true);
    
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('title');
      expect(result[0]).toHaveProperty('content');
      expect(result[0]).toHaveProperty('startLine');
      expect(result[0]).toHaveProperty('endLine');
    }
  });

  it('should re-export addTask functions', async () => {
    const markdownModule = await import('src/utils/markdown');

    expect(typeof markdownModule.addTaskToSection).toBe('function');
  });

  it('should re-export updateTask functions', async () => {
    const markdownModule = await import('src/utils/markdown');

    expect(typeof markdownModule.updateTaskStatus).toBe('function');
    expect(typeof markdownModule.updateTaskText).toBe('function');
    expect(typeof markdownModule.updateTaskDescription).toBe('function');
  });

  it('should re-export removeTask functions', async () => {
    const markdownModule = await import('src/utils/markdown');

    expect(typeof markdownModule.removeTask).toBe('function');
  });

  it('should provide backward compatibility', async () => {
    // This tests that existing code importing from 'src/utils/markdown' still works
    const markdownModule = await import('src/utils/markdown');

    const content = `# Test Section
- [ ] Test task`;

    // Test that all the main functions work through the index
    const sections = markdownModule.parseMarkdownSections(content);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Test Section');

    const withNewTask = markdownModule.addTaskToSection(content, 'Test Section', 'New task');
    expect(withNewTask).toContain('- [ ] New task');

    const lines = ['- [ ] Task', '  Description'];
    const descriptions = markdownModule.getTaskDescriptionLines(lines, 1);
    expect(descriptions).toEqual(['  Description']);

    const updatedStatus = markdownModule.updateTaskStatus(content, 2, 'completed');
    expect(updatedStatus).toContain('- [x] Test task');

    const updatedText = markdownModule.updateTaskText(content, 2, 'Updated task');
    expect(updatedText).toContain('- [ ] Updated task');

    const updatedDesc = markdownModule.updateTaskDescription(content, 2, 'New description');
    expect(updatedDesc).toContain('  New description');

    const removed = markdownModule.removeTask(content, 2);
    expect(removed).not.toContain('- [ ] Test task');
  });

  it('should maintain function signatures', async () => {
    const markdownModule = await import('src/utils/markdown');

    // Test function call signatures to ensure they match expected interface
    const content = '# Test\n- [ ] Task';
    
    // parseMarkdownSections should accept string and return array
    const sections = markdownModule.parseMarkdownSections(content);
    expect(Array.isArray(sections)).toBe(true);

    // addTaskToSection should accept content, section, task text, and optional description
    const added = markdownModule.addTaskToSection(content, 'Test', 'New task', 'Description');
    expect(typeof added).toBe('string');

    // updateTaskStatus should accept content, line number, and status
    const statusUpdated = markdownModule.updateTaskStatus(content, 2, 'completed');
    expect(typeof statusUpdated).toBe('string');

    // updateTaskText should accept content, line number, and new text
    const textUpdated = markdownModule.updateTaskText(content, 2, 'New text');
    expect(typeof textUpdated).toBe('string');

    // updateTaskDescription should accept content, line number, and description (or null)
    const descUpdated = markdownModule.updateTaskDescription(content, 2, 'New desc');
    expect(typeof descUpdated).toBe('string');

    const descRemoved = markdownModule.updateTaskDescription(content, 2, null);
    expect(typeof descRemoved).toBe('string');

    // removeTask should accept content and line number
    const removed = markdownModule.removeTask(content, 2);
    expect(typeof removed).toBe('string');

    // getTaskDescriptionLines should accept lines array and start index
    const descriptions = markdownModule.getTaskDescriptionLines(['- [ ] Task', '  Desc'], 1);
    expect(Array.isArray(descriptions)).toBe(true);
  });
});