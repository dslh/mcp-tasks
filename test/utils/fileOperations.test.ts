import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { setWorkingDirectory } from 'src/config';
import { readFile, changeFile, appendToFile, addTaskToFile } from 'src/utils/fileOperations';

describe('fileOperations', () => {
  const testDir = '/tmp/mcp-tasks-test-fileoperations';

  beforeEach(() => {
    // Create fresh test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    setWorkingDirectory(testDir);
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('readFile', () => {
    it('should read current file contents', () => {
      const content = '# Current Tasks\n- [ ] Task 1\n';

      writeFileSync(join(testDir, 'current.md'), content);

      const result = readFile('current');

      expect(result).toBe(content);
    });

    it('should read backlog file contents', () => {
      const content = '# Backlog\n- [ ] Future task\n';

      writeFileSync(join(testDir, 'backlog.md'), content);

      const result = readFile('backlog');

      expect(result).toBe(content);
    });

    it('should read archive file contents', () => {
      const content = '# Archive\n- [x] Completed task\n';

      writeFileSync(join(testDir, 'archive.md'), content);

      const result = readFile('archive');

      expect(result).toBe(content);
    });

    it('should throw error when file does not exist', () => {
      expect(() => readFile('current')).toThrow();
    });
  });

  describe('changeFile', () => {
    it('should modify file content using modifier function', () => {
      const originalContent = '# Tasks\n- [ ] Original task\n';

      writeFileSync(join(testDir, 'current.md'), originalContent);

      changeFile('current', (content) => content.replace('Original', 'Modified'));

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toBe('# Tasks\n- [ ] Modified task\n');
    });

    it('should handle empty content modification', () => {
      writeFileSync(join(testDir, 'current.md'), '');

      changeFile('current', (content) => `${content}# New Content\n`);

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toBe('# New Content\n');
    });

    it('should preserve original content when modifier returns same content', () => {
      const originalContent = '# Tasks\n- [ ] Task 1\n';

      writeFileSync(join(testDir, 'current.md'), originalContent);

      changeFile('current', (content) => content);

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toBe(originalContent);
    });

    it('should work with different file types', () => {
      writeFileSync(join(testDir, 'backlog.md'), 'Original');

      changeFile('backlog', () => 'Modified');

      const result = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

      expect(result).toBe('Modified');
    });
  });

  describe('appendToFile', () => {
    it('should append content to existing file with content', () => {
      const existingContent = '# Existing Content\n- [ ] Task 1';

      writeFileSync(join(testDir, 'current.md'), existingContent);

      appendToFile('current', '- [ ] New task');

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toBe('# Existing Content\n- [ ] Task 1\n\n- [ ] New task');
    });

    it('should append content to empty file', () => {
      writeFileSync(join(testDir, 'current.md'), '');

      appendToFile('current', '# New Content\n- [ ] Task 1');

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toBe('# New Content\n- [ ] Task 1');
    });

    it('should append content to file with only whitespace', () => {
      writeFileSync(join(testDir, 'current.md'), '   \n  \n');

      appendToFile('current', '# Content');

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toBe('# Content');
    });

    it('should handle multiline content append', () => {
      writeFileSync(join(testDir, 'current.md'), '# Tasks');

      appendToFile('current', 'New section:\n- [ ] Task 1\n- [ ] Task 2');

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toBe('# Tasks\n\nNew section:\n- [ ] Task 1\n- [ ] Task 2');
    });

    it('should work with different file types', () => {
      writeFileSync(join(testDir, 'archive.md'), '# Archive');

      appendToFile('archive', '## Week 1\n- [x] Completed');

      const result = readFileSync(join(testDir, 'archive.md'), 'utf-8');

      expect(result).toBe('# Archive\n\n## Week 1\n- [x] Completed');
    });
  });

  describe('addTaskToFile', () => {
    it('should add task to existing section', () => {
      const content = `# Today
- [ ] Existing task

# Later
- [ ] Other task`;

      writeFileSync(join(testDir, 'current.md'), content);

      addTaskToFile('current', 'Today', 'New task');

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toContain('- [ ] New task');
      expect(result).toContain('# Today');
    });

    it('should add task with description', () => {
      const content = `# Today
- [ ] Existing task`;

      writeFileSync(join(testDir, 'current.md'), content);

      addTaskToFile('current', 'Today', 'Complex task', 'This task needs\nmultiple steps');

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toContain('- [ ] Complex task');
      expect(result).toContain('  This task needs');
      expect(result).toContain('  multiple steps');
    });

    it('should throw error for non-existent section', () => {
      const content = '# Tasks\n\n## Existing\n- [ ] Task';

      writeFileSync(join(testDir, 'current.md'), content);

      expect(() => {
        addTaskToFile('current', 'New Section', 'New task');
      }).toThrow('Section "New Section" not found');
    });

    it('should throw error when file has no sections', () => {
      writeFileSync(join(testDir, 'current.md'), '');

      expect(() => {
        addTaskToFile('current', 'First Section', 'First task');
      }).toThrow('Section "First Section" not found');
    });

    it('should work with different file types', () => {
      const content = `# Future
- [ ] Existing task`;

      writeFileSync(join(testDir, 'backlog.md'), content);

      addTaskToFile('backlog', 'Future', 'Future task', 'For later');

      const result = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

      expect(result).toContain('# Future');
      expect(result).toContain('- [ ] Future task');
      expect(result).toContain('  For later');
    });
  });

  describe('error handling', () => {
    it('should propagate errors from readFileSync in readFile', () => {
      expect(() => readFile('current')).toThrow();
    });

    it('should propagate errors from readFileSync in changeFile', () => {
      expect(() => changeFile('current', (content) => content)).toThrow();
    });

    it('should propagate errors from readFileSync in appendToFile', () => {
      expect(() => appendToFile('current', 'content')).toThrow();
    });

    it('should propagate errors from readFileSync in addTaskToFile', () => {
      expect(() => addTaskToFile('current', 'section', 'task')).toThrow();
    });
  });
});
