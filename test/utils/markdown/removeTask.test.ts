import { describe, it, expect } from 'bun:test';
import { removeTask } from 'src/utils/markdown/removeTask';

describe('removeTask', () => {
  const sampleContent = `# Tasks
- [ ] First task
- [ ] Task with description
  This is a description
  Multi-line description
- [x] Completed task
- [-] Closed task
- [ ] Last task

# Other Section
Some other content`;

  it('should remove simple task without description', () => {
    const result = removeTask(sampleContent, 2);

    expect(result).not.toContain('- [ ] First task');
    expect(result).toContain('- [ ] Task with description');
    expect(result).toContain('- [x] Completed task');
    expect(result).toContain('- [-] Closed task');
    expect(result).toContain('- [ ] Last task');
  });

  it('should remove task with description', () => {
    const result = removeTask(sampleContent, 3);

    expect(result).toContain('- [ ] First task');
    expect(result).not.toContain('- [ ] Task with description');
    expect(result).not.toContain('  This is a description');
    expect(result).not.toContain('  Multi-line description');
    expect(result).toContain('- [x] Completed task');
  });

  it('should remove completed task', () => {
    const result = removeTask(sampleContent, 6);

    expect(result).toContain('- [ ] First task');
    expect(result).toContain('- [ ] Task with description');
    expect(result).not.toContain('- [x] Completed task');
    expect(result).toContain('- [-] Closed task');
  });

  it('should remove closed task', () => {
    const result = removeTask(sampleContent, 7);

    expect(result).toContain('- [ ] First task');
    expect(result).toContain('- [x] Completed task');
    expect(result).not.toContain('- [-] Closed task');
    expect(result).toContain('- [ ] Last task');
  });

  it('should preserve other sections and content', () => {
    const result = removeTask(sampleContent, 2);

    expect(result).toContain('# Tasks');
    expect(result).toContain('# Other Section');
    expect(result).toContain('Some other content');
  });

  it('should throw error for invalid line number', () => {
    expect(() => {
      removeTask(sampleContent, 20);
    }).toThrow('Line 20 not found in content');
  });

  it('should throw error for non-task line', () => {
    expect(() => {
      removeTask(sampleContent, 1); // Header line
    }).toThrow('No task found at line 1');

    expect(() => {
      removeTask(sampleContent, 10); // Other content line
    }).toThrow('No task found at line 10');
  });

  it('should handle task at beginning of content', () => {
    const beginningContent = `- [ ] First task
- [ ] Second task`;

    const result = removeTask(beginningContent, 1);

    expect(result).not.toContain('- [ ] First task');
    expect(result).toContain('- [ ] Second task');
  });

  it('should handle task at end of content', () => {
    const endContent = `- [ ] First task
- [ ] Last task`;

    const result = removeTask(endContent, 2);

    expect(result).toContain('- [ ] First task');
    expect(result).not.toContain('- [ ] Last task');
  });

  it('should handle single task removal', () => {
    const singleTask = `# Section
- [ ] Only task`;

    const result = removeTask(singleTask, 2);

    expect(result).toContain('# Section');
    expect(result).not.toContain('- [ ] Only task');
  });

  it('should handle task with complex description', () => {
    const complexContent = `# Tasks
- [ ] Complex task
  Line 1 of description
  Line 2 of description
  Line 3 of description
- [ ] Next task`;

    const result = removeTask(complexContent, 2);

    expect(result).not.toContain('- [ ] Complex task');
    expect(result).not.toContain('  Line 1 of description');
    expect(result).not.toContain('  Line 2 of description');
    expect(result).not.toContain('  Line 3 of description');
    expect(result).toContain('- [ ] Next task');
  });

  it('should maintain proper line structure after removal', () => {
    const result = removeTask(sampleContent, 3);

    const lines = result.split('\n');

    // Should not have empty gaps where the task was
    expect(lines.filter(line => line.trim() === '')).toHaveLength(1); // Only the original empty line
  });

  it('should handle adjacent tasks correctly', () => {
    const adjacentTasks = `- [ ] Task 1
- [ ] Task 2
- [ ] Task 3`;

    const result = removeTask(adjacentTasks, 2);

    expect(result).toContain('- [ ] Task 1');
    expect(result).not.toContain('- [ ] Task 2');
    expect(result).toContain('- [ ] Task 3');
  });

  it('should handle task followed by empty lines', () => {
    const taskWithSpacing = `- [ ] Task with spacing


- [ ] Next task`;

    const result = removeTask(taskWithSpacing, 1);

    expect(result).not.toContain('- [ ] Task with spacing');
    expect(result).toContain('- [ ] Next task');
  });
});
