import { describe, it, expect } from 'bun:test';
import { updateTaskStatus, updateTaskText, updateTaskDescription } from 'src/utils/markdown/updateTask';

describe('updateTaskStatus', () => {
  const sampleContent = `# Tasks
- [ ] Incomplete task
- [x] Complete task
- [-] Closed task
Some other content`;

  it('should mark task as completed', () => {
    const result = updateTaskStatus(sampleContent, 2, 'completed');

    expect(result).toContain('- [x] Incomplete task');
    expect(result).toContain('- [x] Complete task');
    expect(result).toContain('- [-] Closed task');
  });

  it('should mark task as closed', () => {
    const result = updateTaskStatus(sampleContent, 3, 'closed');

    expect(result).toContain('- [ ] Incomplete task');
    expect(result).toContain('- [-] Complete task');
    expect(result).toContain('- [-] Closed task');
  });

  it('should throw error for invalid line number', () => {
    expect(() => {
      updateTaskStatus(sampleContent, 10, 'completed');
    }).toThrow('Line 10 not found in content');
  });

  it('should throw error for non-task line', () => {
    expect(() => {
      updateTaskStatus(sampleContent, 5, 'completed');
    }).toThrow('No task found at line 5');
  });

  it('should preserve task text when updating status', () => {
    const result = updateTaskStatus(sampleContent, 2, 'completed');

    expect(result).toContain('- [x] Incomplete task');
  });
});

describe('updateTaskText', () => {
  const sampleContent = `# Tasks
- [ ] Original task text
- [x] Completed task
- [-] Closed task`;

  it('should update task text while preserving status', () => {
    const result = updateTaskText(sampleContent, 2, 'Updated task text');

    expect(result).toContain('- [ ] Updated task text');
    expect(result).toContain('- [x] Completed task');
    expect(result).toContain('- [-] Closed task');
  });

  it('should update completed task text', () => {
    const result = updateTaskText(sampleContent, 3, 'New completed task');

    expect(result).toContain('- [ ] Original task text');
    expect(result).toContain('- [x] New completed task');
    expect(result).toContain('- [-] Closed task');
  });

  it('should update closed task text', () => {
    const result = updateTaskText(sampleContent, 4, 'New closed task');

    expect(result).toContain('- [ ] Original task text');
    expect(result).toContain('- [x] Completed task');
    expect(result).toContain('- [-] New closed task');
  });

  it('should throw error for invalid line number', () => {
    expect(() => {
      updateTaskText(sampleContent, 10, 'New text');
    }).toThrow('Line 10 not found in content');
  });

  it('should throw error for non-task line', () => {
    const contentWithNonTask = `# Tasks
Not a task line`;

    expect(() => {
      updateTaskText(contentWithNonTask, 2, 'New text');
    }).toThrow('No task found at line 2');
  });
});

describe('updateTaskDescription', () => {
  const sampleContent = `# Tasks
- [ ] Task with description
  Original description line 1
  Original description line 2
- [ ] Task without description
- [ ] Another task`;

  it('should update existing description', () => {
    const result = updateTaskDescription(sampleContent, 2, 'New description');

    expect(result).toContain('- [ ] Task with description');
    expect(result).toContain('  New description');
    expect(result).not.toContain('  Original description line 1');
    expect(result).not.toContain('  Original description line 2');
  });

  it('should add description to task without one', () => {
    const result = updateTaskDescription(sampleContent, 5, 'Added description');

    expect(result).toContain('- [ ] Task without description');
    expect(result).toContain('  Added description');
  });

  it('should handle multiline description', () => {
    const newDescription = 'Line 1\nLine 2\nLine 3';
    const result = updateTaskDescription(sampleContent, 1, newDescription);

    expect(result).toContain('- [ ] Task with description');
    expect(result).toContain('  Line 1');
    expect(result).toContain('  Line 2');
    expect(result).toContain('  Line 3');
  });

  it('should remove description when set to empty string', () => {
    const result = updateTaskDescription(sampleContent, 2, '');

    expect(result).toContain('- [ ] Task with description');
    expect(result).not.toContain('  Original description line 1');
    expect(result).not.toContain('  Original description line 2');
  });

  it('should remove description when set to null', () => {
    const result = updateTaskDescription(sampleContent, 2, null);

    expect(result).toContain('- [ ] Task with description');
    expect(result).not.toContain('  Original description line 1');
    expect(result).not.toContain('  Original description line 2');
  });

  it('should preserve other tasks and content', () => {
    const result = updateTaskDescription(sampleContent, 2, 'New description');

    expect(result).toContain('- [ ] Task without description');
    expect(result).toContain('- [ ] Another task');
    expect(result).toContain('# Tasks');
  });

  it('should throw error for invalid line number', () => {
    expect(() => {
      updateTaskDescription(sampleContent, 10, 'New description');
    }).toThrow('Line 10 not found in content');
  });

  it('should handle task at end of content', () => {
    const endContent = `# Tasks
- [ ] Last task
  Description`;

    const result = updateTaskDescription(endContent, 2, 'New description');

    expect(result).toContain('- [ ] Last task');
    expect(result).toContain('  New description');
    expect(result).not.toContain('  Description');
  });

  it('should handle whitespace-only description', () => {
    const result = updateTaskDescription(sampleContent, 2, '   ');

    expect(result).toContain('- [ ] Task with description');
    expect(result).not.toContain('  Original description line 1');
    expect(result).not.toContain('  Original description line 2');
  });

  it('should preserve line structure when updating description', () => {
    const result = updateTaskDescription(sampleContent, 5, 'New description');

    const lines = result.split('\n');
    const taskIndex = lines.findIndex(line => line === '- [ ] Task without description');
    
    expect(lines[taskIndex + 1]).toBe('  New description');
  });
});