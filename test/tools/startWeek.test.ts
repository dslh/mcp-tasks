import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { setWorkingDirectory } from 'src/config';
import { name, config, handler } from 'src/tools/startWeek';

// Mock git operations and dates
const mockCommitChanges = mock(() => Promise.resolve());
const mockGetCurrentDate = mock(() => '2024-01-15');
const mockGetArchiveWeekDate = mock(() => '2024-01-08');

mock.module('src/utils/git', () => ({
  commitChanges: mockCommitChanges,
}));

mock.module('src/utils/dates', () => ({
  getCurrentDate: mockGetCurrentDate,
  getArchiveWeekDate: mockGetArchiveWeekDate,
}));

describe('startWeek tool', () => {
  const testDir = '/tmp/mcp-tasks-test-startweek';

  beforeEach(() => {
    // Create fresh test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    setWorkingDirectory(testDir);

    // Create current.md with complete weekly structure
    writeFileSync(join(testDir, 'current.md'), `# Last Week
- [x] Completed last week task
- [-] Closed last week task
- [ ] Unfinished last week task
- [x] Task with description from last week
  Last week description
  Multiple lines

# This Week
- [x] Completed this week task
- [-] Closed this week task  
- [ ] Unfinished this week task
- [ ] Another unfinished task
- [x] This week task with description
  This week description
  Details here

# Next Week
- [ ] Next week task 1
- [ ] Next week task 2
- [ ] Next week task with description
  Next week description`);

    // Create archive.md with existing content
    writeFileSync(join(testDir, 'archive.md'), `# Week of 2024-01-01
- [x] Old completed task
- [-] Old closed task

# Week of 2023-12-25
- [x] Very old task`);

    // Create backlog.md (should not be modified by startWeek)
    writeFileSync(join(testDir, 'backlog.md'), `# Backlog
- [ ] Backlog task 1 added on 2024-01-01
- [ ] Backlog task 2 added on 2024-01-02`);

    // Reset mocks
    mockCommitChanges.mockClear();
    mockGetCurrentDate.mockReturnValue('2024-01-15');
    mockGetArchiveWeekDate.mockReturnValue('2024-01-08');
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('tool metadata', () => {
    it('should export correct tool name', () => {
      expect(name).toBe('start_week');
    });

    it('should export correct config structure', () => {
      expect(config).toEqual({
        title: 'Start Week',
        description: 'Execute the weekly transition: archive last week, move current week to last week, next week to current week',
        inputSchema: {},
      });
    });

    it('should have empty input schema', () => {
      expect(config.inputSchema).toEqual({});
    });
  });

  describe('handler function', () => {
    describe('successful week transition', () => {
      it('should complete full weekly transition workflow', async () => {
        const result = await handler();

        // Verify success response
        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Successfully completed week transition. Archived week of 2024-01-08.',
          }],
        });

        // Verify git commits were made
        expect(mockCommitChanges).toHaveBeenCalledTimes(2);
        expect(mockCommitChanges).toHaveBeenNthCalledWith(1, 'Pre-start-week backup');
        expect(mockCommitChanges).toHaveBeenNthCalledWith(2, 'Completed week transition to 2024-01-15');
      });

      it('should archive last week content to archive.md', async () => {
        await handler();

        const archiveContent = readFileSync(join(testDir, 'archive.md'), 'utf-8');

        // Should append new week section
        expect(archiveContent).toContain('# Week of 2024-01-08');
        expect(archiveContent).toContain('- [x] Completed last week task');
        expect(archiveContent).toContain('- [-] Closed last week task');
        expect(archiveContent).toContain('- [ ] Unfinished last week task');
        expect(archiveContent).toContain('- [x] Task with description from last week');
        expect(archiveContent).toContain('  Last week description');
        expect(archiveContent).toContain('  Multiple lines');

        // Should preserve existing archive content
        expect(archiveContent).toContain('# Week of 2024-01-01');
        expect(archiveContent).toContain('# Week of 2023-12-25');
        expect(archiveContent).toContain('- [x] Old completed task');
      });

      it('should rebuild current.md with proper section transitions', async () => {
        await handler();

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const sections = currentContent.split('#').filter(s => s.trim());

        // Should have exactly 3 sections
        expect(sections).toHaveLength(3);

        // Verify section headers
        expect(currentContent).toContain('# Last Week');
        expect(currentContent).toContain('# This Week');
        expect(currentContent).toContain('# Next Week');
      });
    });

    describe('task filtering and transitions', () => {
      it('should move completed/closed tasks from This Week to Last Week', async () => {
        await handler();

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const lines = currentContent.split('\n');

        // Find Last Week section
        const lastWeekStart = lines.findIndex(line => line === '# Last Week');
        const thisWeekStart = lines.findIndex(line => line === '# This Week');
        const lastWeekLines = lines.slice(lastWeekStart + 1, thisWeekStart);

        // Should contain completed/closed tasks from this week
        expect(lastWeekLines.join('\n')).toContain('- [x] Completed this week task');
        expect(lastWeekLines.join('\n')).toContain('- [-] Closed this week task');
        expect(lastWeekLines.join('\n')).toContain('- [x] This week task with description');
        expect(lastWeekLines.join('\n')).toContain('  This week description');
        expect(lastWeekLines.join('\n')).toContain('  Details here');
      });

      it('should move unfinished tasks from This Week to This Week (preserve)', async () => {
        await handler();

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const lines = currentContent.split('\n');

        // Find This Week section
        const thisWeekStart = lines.findIndex(line => line === '# This Week');
        const nextWeekStart = lines.findIndex(line => line === '# Next Week');
        const thisWeekLines = lines.slice(thisWeekStart + 1, nextWeekStart);

        // Should contain unfinished tasks from previous This Week
        expect(thisWeekLines.join('\n')).toContain('- [ ] Unfinished this week task');
        expect(thisWeekLines.join('\n')).toContain('- [ ] Another unfinished task');

        // Should NOT contain completed/closed tasks
        expect(thisWeekLines.join('\n')).not.toContain('- [x] Completed this week task');
        expect(thisWeekLines.join('\n')).not.toContain('- [-] Closed this week task');
      });

      it('should move tasks from Next Week to This Week', async () => {
        await handler();

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const lines = currentContent.split('\n');

        // Find This Week section
        const thisWeekStart = lines.findIndex(line => line === '# This Week');
        const nextWeekStart = lines.findIndex(line => line === '# Next Week');
        const thisWeekLines = lines.slice(thisWeekStart + 1, nextWeekStart);

        // Should contain tasks from previous Next Week
        expect(thisWeekLines.join('\n')).toContain('- [ ] Next week task 1');
        expect(thisWeekLines.join('\n')).toContain('- [ ] Next week task 2');
        expect(thisWeekLines.join('\n')).toContain('- [ ] Next week task with description');
        expect(thisWeekLines.join('\n')).toContain('  Next week description');
      });

      it('should leave Next Week section empty after transition', async () => {
        await handler();

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const lines = currentContent.split('\n');

        // Find Next Week section (should be at the end)
        const nextWeekStart = lines.findIndex(line => line === '# Next Week');
        const nextWeekLines = lines.slice(nextWeekStart + 1);

        // Should be empty (or just whitespace)
        const nonEmptyLines = nextWeekLines.filter(line => line.trim() !== '');
        expect(nonEmptyLines).toHaveLength(0);
      });
    });

    describe('description preservation', () => {
      it('should preserve task descriptions during all transitions', async () => {
        await handler();

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        // Check Last Week section (moved from This Week)
        expect(currentContent).toContain('- [x] This week task with description');
        expect(currentContent).toContain('  This week description');
        expect(currentContent).toContain('  Details here');

        // Check This Week section (moved from Next Week)  
        expect(currentContent).toContain('- [ ] Next week task with description');
        expect(currentContent).toContain('  Next week description');

        // Check archive for Last Week descriptions
        const archiveContent = readFileSync(join(testDir, 'archive.md'), 'utf-8');
        expect(archiveContent).toContain('- [x] Task with description from last week');
        expect(archiveContent).toContain('  Last week description');
        expect(archiveContent).toContain('  Multiple lines');
      });

      it('should handle tasks without descriptions correctly', async () => {
        await handler();

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        // Tasks without descriptions should still be moved properly
        expect(currentContent).toContain('- [x] Completed this week task');
        expect(currentContent).toContain('- [ ] Unfinished this week task');
        expect(currentContent).toContain('- [ ] Next week task 1');
      });
    });

    describe('file operations', () => {
      it('should not modify backlog.md', async () => {
        const originalBacklog = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        await handler();

        const currentBacklog = readFileSync(join(testDir, 'backlog.md'), 'utf-8');
        expect(currentBacklog).toBe(originalBacklog);
      });

      it('should preserve existing archive content', async () => {
        await handler();

        const archiveContent = readFileSync(join(testDir, 'archive.md'), 'utf-8');

        // Should still contain old archive entries
        expect(archiveContent).toContain('# Week of 2024-01-01');
        expect(archiveContent).toContain('- [x] Old completed task');
        expect(archiveContent).toContain('- [-] Old closed task');
        expect(archiveContent).toContain('# Week of 2023-12-25');
        expect(archiveContent).toContain('- [x] Very old task');
      });

      it('should maintain proper file structure and formatting', async () => {
        await handler();

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        // Should have proper markdown structure
        expect(currentContent.split('# Last Week')).toHaveLength(2);
        expect(currentContent.split('# This Week')).toHaveLength(2);
        expect(currentContent.split('# Next Week')).toHaveLength(2);

        // Should end with proper formatting
        expect(currentContent.endsWith('\n')).toBe(true);
      });
    });

    describe('date handling', () => {
      it('should use archive date for archive section title', async () => {
        mockGetArchiveWeekDate.mockReturnValue('2024-02-05');

        await handler();

        const archiveContent = readFileSync(join(testDir, 'archive.md'), 'utf-8');
        expect(archiveContent).toContain('# Week of 2024-02-05');
      });

      it('should use current date in commit message', async () => {
        mockGetCurrentDate.mockReturnValue('2024-02-12');

        await handler();

        expect(mockCommitChanges).toHaveBeenNthCalledWith(2, 'Completed week transition to 2024-02-12');
      });

      it('should use correct dates in success message', async () => {
        mockGetArchiveWeekDate.mockReturnValue('2024-03-04');

        const result = await handler();

        expect(result.content[0].text).toBe('Successfully completed week transition. Archived week of 2024-03-04.');
      });
    });

    describe('git workflow', () => {
      it('should make pre-backup commit before changes', async () => {
        await handler();

        // First commit should be pre-backup
        expect(mockCommitChanges).toHaveBeenNthCalledWith(1, 'Pre-start-week backup');
      });

      it('should make final commit after changes', async () => {
        await handler();

        // Second commit should be final
        expect(mockCommitChanges).toHaveBeenNthCalledWith(2, 'Completed week transition to 2024-01-15');
      });

      it('should handle git failure during pre-backup', async () => {
        mockCommitChanges.mockRejectedValueOnce(new Error('Git pre-backup failed'));

        const result = await handler();

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error during week transition: Git pre-backup failed');

        // Should not make second commit if first fails
        expect(mockCommitChanges).toHaveBeenCalledTimes(1);
      });

      it('should handle git failure during final commit', async () => {
        mockCommitChanges
          .mockResolvedValueOnce(undefined) // Pre-backup succeeds
          .mockRejectedValueOnce(new Error('Git final commit failed')); // Final commit fails

        const result = await handler();

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error during week transition: Git final commit failed');

        // Should have attempted both commits
        expect(mockCommitChanges).toHaveBeenCalledTimes(2);
      });
    });

    describe('error scenarios', () => {
      it('should handle missing Last Week section', async () => {
        writeFileSync(join(testDir, 'current.md'), `# This Week
- [ ] Task 1

# Next Week  
- [ ] Task 2`);

        const result = await handler();

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error during week transition: Required sections not found in current.md');

        // Should make pre-backup commit but not final commit
        expect(mockCommitChanges).toHaveBeenCalledTimes(1);
        expect(mockCommitChanges).toHaveBeenCalledWith('Pre-start-week backup');
      });

      it('should handle missing This Week section', async () => {
        writeFileSync(join(testDir, 'current.md'), `# Last Week
- [x] Task 1

# Next Week
- [ ] Task 2`);

        const result = await handler();

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Required sections not found in current.md');
      });

      it('should handle missing Next Week section', async () => {
        writeFileSync(join(testDir, 'current.md'), `# Last Week
- [x] Task 1

# This Week
- [ ] Task 2`);

        const result = await handler();

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Required sections not found in current.md');
      });

      it('should handle file read/write errors gracefully', async () => {
        // Remove current.md to simulate file error
        rmSync(join(testDir, 'current.md'));

        const result = await handler();

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error during week transition:');
      });
    });

    describe('edge cases', () => {
      it('should handle empty sections gracefully', async () => {
        writeFileSync(join(testDir, 'current.md'), `# Last Week

# This Week

# Next Week
`);

        const result = await handler();

        expect(result).not.toHaveProperty('isError');

        // Should create proper structure even with empty sections
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        expect(currentContent).toContain('# Last Week');
        expect(currentContent).toContain('# This Week');
        expect(currentContent).toContain('# Next Week');
      });

      it('should handle sections with only completed tasks', async () => {
        writeFileSync(join(testDir, 'current.md'), `# Last Week
- [x] All completed

# This Week
- [x] All done task 1
- [-] All done task 2

# Next Week
- [ ] Future task`);

        await handler();

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const lines = currentContent.split('\n');

        // Last Week should have the completed tasks from This Week
        const lastWeekStart = lines.findIndex(line => line === '# Last Week');
        const thisWeekStart = lines.findIndex(line => line === '# This Week');
        const lastWeekLines = lines.slice(lastWeekStart + 1, thisWeekStart);

        expect(lastWeekLines.join('\n')).toContain('- [x] All done task 1');
        expect(lastWeekLines.join('\n')).toContain('- [-] All done task 2');

        // This Week should have the Next Week tasks
        const nextWeekStart = lines.findIndex(line => line === '# Next Week');
        const thisWeekLines = lines.slice(thisWeekStart + 1, nextWeekStart);

        expect(thisWeekLines.join('\n')).toContain('- [ ] Future task');
      });

      it('should handle sections with only unfinished tasks', async () => {
        writeFileSync(join(testDir, 'current.md'), `# Last Week
- [ ] Unfinished last week

# This Week
- [ ] Unfinished task 1
- [ ] Unfinished task 2

# Next Week
- [ ] Future task`);

        await handler();

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const lines = currentContent.split('\n');

        // This Week should have both old unfinished and next week tasks
        const thisWeekStart = lines.findIndex(line => line === '# This Week');
        const nextWeekStart = lines.findIndex(line => line === '# Next Week');
        const thisWeekLines = lines.slice(thisWeekStart + 1, nextWeekStart);

        expect(thisWeekLines.join('\n')).toContain('- [ ] Unfinished task 1');
        expect(thisWeekLines.join('\n')).toContain('- [ ] Unfinished task 2');
        expect(thisWeekLines.join('\n')).toContain('- [ ] Future task');
      });

    });

    describe('MCP response structure', () => {
      it('should return proper MCP structure for success', async () => {
        const result = await handler();

        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0]).toHaveProperty('text');
        expect(result).not.toHaveProperty('isError');
      });

      it('should return proper MCP structure for errors', async () => {
        // Force an error by removing current.md
        rmSync(join(testDir, 'current.md'));

        const result = await handler();

        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0]).toHaveProperty('text');
        expect(result.isError).toBe(true);
      });
    });
  });
});
