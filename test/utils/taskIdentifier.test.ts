import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { setWorkingDirectory } from 'src/config';
import { findAllTasks, findMatchingTasks, validateTaskMatch } from 'src/utils/taskIdentifier';

describe('taskIdentifier', () => {
  const testDir = '/tmp/mcp-tasks-test-taskidentifier';

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

  describe('findAllTasks', () => {
    it('should find tasks in current file only', () => {
      const currentContent = `# Today
- [ ] Write tests
- [x] Complete feature
- [-] Cancelled task

# Later
- [ ] Review code`;

      const backlogContent = `# Future
- [ ] Plan next sprint`;

      writeFileSync(`${testDir}/current.md`, currentContent);
      writeFileSync(`${testDir}/backlog.md`, backlogContent);

      const tasks = findAllTasks();

      const currentTasks = tasks.filter(task => task.file === 'current');

      expect(currentTasks).toHaveLength(4);
      expect(currentTasks[0]).toEqual({
        file: 'current',
        section: 'Today',
        taskText: 'Write tests',
        lineNumber: 2,
        isCompleted: false,
        isClosed: false,
      });
      expect(currentTasks[1]).toEqual({
        file: 'current',
        section: 'Today',
        taskText: 'Complete feature',
        lineNumber: 3,
        isCompleted: true,
        isClosed: false,
      });
      expect(currentTasks[2]).toEqual({
        file: 'current',
        section: 'Today',
        taskText: 'Cancelled task',
        lineNumber: 4,
        isCompleted: false,
        isClosed: true,
      });
    });

    it('should find tasks in backlog file only', () => {
      const currentContent = `# Today
- [ ] Current task`;

      const backlogContent = `# Future
- [ ] Future task
- [x] Done future task`;

      writeFileSync(`${testDir}/current.md`, currentContent);
      writeFileSync(`${testDir}/backlog.md`, backlogContent);

      const tasks = findAllTasks();

      const backlogTasks = tasks.filter(task => task.file === 'backlog');

      expect(backlogTasks).toHaveLength(2);
      expect(backlogTasks[0]).toEqual({
        file: 'backlog',
        section: 'Future',
        taskText: 'Future task',
        lineNumber: 2,
        isCompleted: false,
        isClosed: false,
      });
    });

    it('should find tasks in both files', () => {
      const currentContent = `# Today
- [ ] Current task`;

      const backlogContent = `# Future
- [ ] Future task`;

      writeFileSync(`${testDir}/current.md`, currentContent);
      writeFileSync(`${testDir}/backlog.md`, backlogContent);

      const tasks = findAllTasks();

      expect(tasks).toHaveLength(2);
      expect(tasks.some(task => task.file === 'current')).toBe(true);
      expect(tasks.some(task => task.file === 'backlog')).toBe(true);
    });

    it('should handle empty files', () => {
      writeFileSync(`${testDir}/current.md`, '');
      writeFileSync(`${testDir}/backlog.md`, '');

      const tasks = findAllTasks();

      expect(tasks).toHaveLength(0);
    });

    it('should handle files with no tasks', () => {
      const currentContent = `# Today
Some text but no tasks

# Later
More text`;

      const backlogContent = `# Future
Just headers and text`;

      writeFileSync(`${testDir}/current.md`, currentContent);
      writeFileSync(`${testDir}/backlog.md`, backlogContent);

      const tasks = findAllTasks();

      expect(tasks).toHaveLength(0);
    });

    it('should ignore non-task lines', () => {
      const currentContent = `# Today
- [ ] Valid task
Some regular text
- Not a task (missing brackets)
- [invalid] Invalid checkbox
- [ ] Another valid task`;

      writeFileSync(`${testDir}/current.md`, currentContent);
      writeFileSync(`${testDir}/backlog.md`, '');

      const tasks = findAllTasks();

      expect(tasks).toHaveLength(2);
      expect(tasks[0].taskText).toBe('Valid task');
      expect(tasks[1].taskText).toBe('Another valid task');
    });

    it('should handle multiple sections correctly', () => {
      const currentContent = `# Section 1
- [ ] Task 1

# Section 2
- [x] Task 2
- [-] Task 3

# Section 3
- [ ] Task 4`;

      writeFileSync(`${testDir}/current.md`, currentContent);
      writeFileSync(`${testDir}/backlog.md`, '');

      const tasks = findAllTasks();

      expect(tasks).toHaveLength(4);
      expect(tasks[0].section).toBe('Section 1');
      expect(tasks[1].section).toBe('Section 2');
      expect(tasks[2].section).toBe('Section 2');
      expect(tasks[3].section).toBe('Section 3');
    });
  });

  describe('findMatchingTasks', () => {
    beforeEach(() => {
      const currentContent = `# Today
- [ ] Write comprehensive tests
- [x] Complete feature implementation
- [-] Cancelled meeting

# Later
- [ ] Review pull requests
- [ ] Write documentation`;

      const backlogContent = `# Future
- [ ] Plan next sprint
- [ ] Write performance tests`;

      writeFileSync(`${testDir}/current.md`, currentContent);
      writeFileSync(`${testDir}/backlog.md`, backlogContent);
    });

    it('should find exact substring matches', () => {
      const matches = findMatchingTasks('tests');

      expect(matches).toHaveLength(2);
      expect(matches[0].taskText).toBe('Write comprehensive tests');
      expect(matches[1].taskText).toBe('Write performance tests');
    });

    it('should be case insensitive', () => {
      const matches = findMatchingTasks('WRITE');

      expect(matches).toHaveLength(3);
      expect(matches.some(m => m.taskText.includes('comprehensive'))).toBe(true);
      expect(matches.some(m => m.taskText.includes('documentation'))).toBe(true);
      expect(matches.some(m => m.taskText.includes('performance'))).toBe(true);
    });

    it('should find partial matches', () => {
      const matches = findMatchingTasks('feature');

      expect(matches).toHaveLength(1);
      expect(matches[0].taskText).toBe('Complete feature implementation');
    });

    it('should return empty array for no matches', () => {
      const matches = findMatchingTasks('nonexistent');

      expect(matches).toHaveLength(0);
    });

    it('should throw error for empty identifier', () => {
      expect(() => findMatchingTasks('')).toThrow('Task identifier cannot be empty');
      expect(() => findMatchingTasks('   ')).toThrow('Task identifier cannot be empty');
    });

    it('should match across different files', () => {
      const matches = findMatchingTasks('write');

      const currentMatches = matches.filter(m => m.file === 'current');
      const backlogMatches = matches.filter(m => m.file === 'backlog');

      expect(currentMatches).toHaveLength(2);
      expect(backlogMatches).toHaveLength(1);
    });

    it('should include all task statuses in results', () => {
      const matches = findMatchingTasks('e'); // Broad search

      const incomplete = matches.filter(m => !m.isCompleted && !m.isClosed);
      const completed = matches.filter(m => m.isCompleted);
      const closed = matches.filter(m => m.isClosed);

      expect(incomplete.length).toBeGreaterThan(0);
      expect(completed.length).toBeGreaterThan(0);
      expect(closed.length).toBeGreaterThan(0);
    });
  });

  describe('validateTaskMatch', () => {
    beforeEach(() => {
      const currentContent = `# Today
- [ ] Write comprehensive tests
- [x] Complete feature implementation
- [-] Cancelled meeting

# Later
- [ ] Review pull requests`;

      const backlogContent = `# Future
- [ ] Plan next sprint`;

      writeFileSync(`${testDir}/current.md`, currentContent);
      writeFileSync(`${testDir}/backlog.md`, backlogContent);
    });

    it('should return single matching task', () => {
      const task = validateTaskMatch('comprehensive');

      expect(task.taskText).toBe('Write comprehensive tests');
      expect(task.file).toBe('current');
      expect(task.section).toBe('Today');
    });

    it('should throw error for no matches with suggestions', () => {
      expect(() => validateTaskMatch('nonexistent')).toThrow(/No matching tasks found for "nonexistent"/);
      expect(() => validateTaskMatch('nonexistent')).toThrow(/Did you mean:/);
    });

    it('should throw error for no matches when no tasks available', () => {
      writeFileSync(`${testDir}/current.md`, '');
      writeFileSync(`${testDir}/backlog.md`, '');

      expect(() => validateTaskMatch('anything')).toThrow(/No tasks available/);
    });

    it('should throw error for multiple matches', () => {
      expect(() => validateTaskMatch('e')).toThrow(/Multiple matches found for "e"/);
      expect(() => validateTaskMatch('e')).toThrow(/Please be more specific/);
    });

    it('should include section names in multiple match error', () => {
      try {
        validateTaskMatch('e');
      } catch (error) {
        expect(error.message).toContain('(in Today)');
        expect(error.message).toContain('(in Later)');
        expect(error.message).toContain('(in Future)');
      }
    });

    it('should throw error for empty identifier', () => {
      expect(() => validateTaskMatch('')).toThrow('Task identifier cannot be empty');
    });

    it('should handle case sensitivity correctly', () => {
      const task = validateTaskMatch('COMPREHENSIVE');

      expect(task.taskText).toBe('Write comprehensive tests');
    });

    it('should work with exact task text match', () => {
      const task = validateTaskMatch('Complete feature implementation');

      expect(task.taskText).toBe('Complete feature implementation');
      expect(task.isCompleted).toBe(true);
    });
  });

  describe('line number calculation', () => {
    it('should calculate correct line numbers', () => {
      const content = `# Section 1
Line after header
- [ ] First task
- [ ] Second task

# Section 2
Another line
- [ ] Third task`;

      writeFileSync(`${testDir}/current.md`, content);
      writeFileSync(`${testDir}/backlog.md`, '');

      const tasks = findAllTasks();

      expect(tasks).toHaveLength(3);
      expect(tasks[0].lineNumber).toBe(3); // First task
      expect(tasks[1].lineNumber).toBe(4); // Second task
      expect(tasks[2].lineNumber).toBe(8); // Third task
    });

    it('should handle sections with no content before tasks', () => {
      const content = `# Section
- [ ] Immediate task`;

      writeFileSync(`${testDir}/current.md`, content);
      writeFileSync(`${testDir}/backlog.md`, '');

      const tasks = findAllTasks();

      expect(tasks[0].lineNumber).toBe(2);
    });
  });

  describe('task status detection', () => {
    it('should correctly identify task statuses', () => {
      const content = `# Tasks
- [ ] Incomplete task
- [x] Completed task
- [-] Closed task`;

      writeFileSync(`${testDir}/current.md`, content);
      writeFileSync(`${testDir}/backlog.md`, '');

      const tasks = findAllTasks();

      expect(tasks).toHaveLength(3);

      expect(tasks[0].isCompleted).toBe(false);
      expect(tasks[0].isClosed).toBe(false);

      expect(tasks[1].isCompleted).toBe(true);
      expect(tasks[1].isClosed).toBe(false);

      expect(tasks[2].isCompleted).toBe(false);
      expect(tasks[2].isClosed).toBe(true);
    });
  });
});
