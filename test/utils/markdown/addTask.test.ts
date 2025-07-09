import { describe, it, expect } from 'bun:test';
import { addTaskToSection } from 'src/utils/markdown/addTask';

describe('addTaskToSection', () => {
  const sampleContent = `# This Week
- [ ] Existing task

# Next Week
- [ ] Another existing task

# Backlog
- [ ] Old task`;

  it('should add task to existing section', () => {
    const result = addTaskToSection(sampleContent, 'This Week', 'New task');

    expect(result).toContain('- [ ] New task');
    expect(result).toContain('- [ ] Existing task');
  });

  it('should add task with description', () => {
    const result = addTaskToSection(
      sampleContent,
      'Next Week',
      'Task with description',
      'This is a detailed description'
    );

    expect(result).toContain('- [ ] Task with description');
    expect(result).toContain('  This is a detailed description');
  });

  it('should add task with multiline description', () => {
    const description = 'First line\nSecond line\nThird line';
    const result = addTaskToSection(sampleContent, 'Backlog', 'Complex task', description);

    expect(result).toContain('- [ ] Complex task');
    expect(result).toContain('  First line');
    expect(result).toContain('  Second line');
    expect(result).toContain('  Third line');
  });

  it('should be case insensitive for section titles', () => {
    const result = addTaskToSection(sampleContent, 'this week', 'Case test');

    expect(result).toContain('- [ ] Case test');
  });

  it('should throw error for non-existent section', () => {
    expect(() => {
      addTaskToSection(sampleContent, 'Non-existent Section', 'New task');
    }).toThrow('Section "Non-existent Section" not found');
  });

  it('should handle empty description', () => {
    const result = addTaskToSection(sampleContent, 'This Week', 'Simple task', '');

    expect(result).toContain('- [ ] Simple task');
    expect(result).not.toContain('  ');
  });

  it('should handle undefined description', () => {
    const result = addTaskToSection(sampleContent, 'This Week', 'Simple task', undefined);

    expect(result).toContain('- [ ] Simple task');
  });

  it('should preserve existing content structure', () => {
    const result = addTaskToSection(sampleContent, 'Next Week', 'New task');

    // Should contain all original content
    expect(result).toContain('# This Week');
    expect(result).toContain('# Next Week');
    expect(result).toContain('# Backlog');
    expect(result).toContain('- [ ] Existing task');
    expect(result).toContain('- [ ] Another existing task');
    expect(result).toContain('- [ ] Old task');
  });

  it('should add task to end of section with proper spacing', () => {
    const result = addTaskToSection(sampleContent, 'This Week', 'Last task');

    const lines = result.split('\n');
    const thisWeekStart = lines.findIndex(line => line === '# This Week');
    const nextWeekStart = lines.findIndex(line => line === '# Next Week');
    
    // Find the new task
    const newTaskIndex = lines.findIndex(line => line === '- [ ] Last task');
    
    // New task should be between This Week section and Next Week section
    expect(newTaskIndex).toBeGreaterThan(thisWeekStart);
    expect(newTaskIndex).toBeLessThan(nextWeekStart);
    
    // Should have empty line after the new task
    expect(lines[newTaskIndex + 1]).toBe('');
  });

  it('should handle section with trailing empty lines', () => {
    const contentWithSpacing = `# This Week
- [ ] Existing task


# Next Week`;

    const result = addTaskToSection(contentWithSpacing, 'This Week', 'New task');

    expect(result).toContain('- [ ] New task');
    expect(result).toContain('- [ ] Existing task');
  });

  it('should handle empty section', () => {
    const emptySection = `# Empty Section

# Next Section
- [ ] Some task`;

    const result = addTaskToSection(emptySection, 'Empty Section', 'First task');

    expect(result).toContain('- [ ] First task');
  });

  it('should maintain correct line structure', () => {
    const result = addTaskToSection(sampleContent, 'This Week', 'Test task', 'Test description');

    const lines = result.split('\n');
    const taskIndex = lines.findIndex(line => line === '- [ ] Test task');
    
    expect(lines[taskIndex + 1]).toBe('  Test description');
    expect(lines[taskIndex + 2]).toBe('');
  });
});