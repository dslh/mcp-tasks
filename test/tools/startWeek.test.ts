import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { setWorkingDirectory } from 'src/config';
import { name, config, handler } from 'src/tools/startWeek';
import * as gitUtils from 'src/utils/git';
import * as dateUtils from 'src/utils/dates';

describe('startWeek tool', () => {
  const testDir = '/tmp/mcp-tasks-test-startweek';

  beforeEach(() => {
    // Create fresh test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    setWorkingDirectory(testDir);

    // Create current.md with 2-section structure
    writeFileSync(join(testDir, 'current.md'), `# This Week
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

    // Set up mocks for this test
    spyOn(gitUtils, 'hasUntrackedFiles').mockResolvedValue(true);
    spyOn(gitUtils, 'commitChanges').mockResolvedValue();
    spyOn(dateUtils, 'getCurrentDate').mockReturnValue('2024-01-15');
    spyOn(dateUtils, 'getArchiveWeekDate').mockReturnValue('2024-01-08');
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    // Clear all spies
    mock.restore();
  });

  describe('tool metadata', () => {
    it('should export correct tool name', () => {
      expect(name).toBe('start_week');
    });

    it('should export correct config structure', () => {
      expect(config).toEqual({
        title: 'Start Week',
        description: 'Execute the weekly transition: archive current week, move incomplete tasks and next week to current week',
        inputSchema: {},
      });
    });

    it('should have empty input schema', () => {
      expect(config.inputSchema).toEqual({});
    });
  });

  describe('handler function', () => {
    describe('successful week transition', () => {
      it('should complete full weekly transition workflow', async() => {
        const result = await handler();

        // Verify success response with This Week section
        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Successfully completed week transition. Archived week of 2024-01-08.\n\n# This Week\n- [ ] Unfinished this week task\n- [ ] Another unfinished task\n\n- [ ] Next week task 1\n- [ ] Next week task 2\n- [ ] Next week task with description\n  Next week description\n',
          }],
        });

        // Verify git commits were made
        expect(gitUtils.commitChanges).toHaveBeenCalledTimes(2);
        expect(gitUtils.commitChanges).toHaveBeenNthCalledWith(1, 'Pre-start-week backup');
        expect(gitUtils.commitChanges).toHaveBeenNthCalledWith(2, 'Completed week transition to 2024-01-15');
      });

      it('should archive this week content to archive.md', async() => {
        await handler();

        const archiveContent = readFileSync(join(testDir, 'archive.md'), 'utf-8');

        // Should append new week section with entire "This Week" content
        expect(archiveContent).toContain('# Week of 2024-01-08');
        expect(archiveContent).toContain('- [x] Completed this week task');
        expect(archiveContent).toContain('- [-] Closed this week task');
        expect(archiveContent).toContain('- [ ] Unfinished this week task');
        expect(archiveContent).toContain('- [ ] Another unfinished task');
        expect(archiveContent).toContain('- [x] This week task with description');
        expect(archiveContent).toContain('  This week description');
        expect(archiveContent).toContain('  Details here');

        // Should preserve existing archive content
        expect(archiveContent).toContain('# Week of 2024-01-01');
        expect(archiveContent).toContain('# Week of 2023-12-25');
        expect(archiveContent).toContain('- [x] Old completed task');
      });

      it('should rebuild current.md with proper section transitions', async() => {
        await handler();

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const sections = currentContent.split('#').filter(s => s.trim());

        // Should have exactly 2 sections
        expect(sections).toHaveLength(2);

        // Verify section headers
        expect(currentContent).toContain('# This Week');
        expect(currentContent).toContain('# Next Week');
      });
    });

    describe('task filtering and transitions', () => {
      it('should move incomplete tasks and next week tasks to new This Week', async() => {
        await handler();

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const lines = currentContent.split('\n');

        // Find This Week section
        const thisWeekStart = lines.findIndex(line => line === '# This Week');
        const nextWeekStart = lines.findIndex(line => line === '# Next Week');
        const thisWeekLines = lines.slice(thisWeekStart + 1, nextWeekStart);
        const thisWeekContent = thisWeekLines.join('\n');

        // Should contain incomplete tasks from previous This Week
        expect(thisWeekContent).toContain('- [ ] Unfinished this week task');
        expect(thisWeekContent).toContain('- [ ] Another unfinished task');

        // Should contain all tasks from previous Next Week
        expect(thisWeekContent).toContain('- [ ] Next week task 1');
        expect(thisWeekContent).toContain('- [ ] Next week task 2');
        expect(thisWeekContent).toContain('- [ ] Next week task with description');
        expect(thisWeekContent).toContain('  Next week description');

        // Should NOT contain completed/closed tasks (they're archived)
        expect(thisWeekContent).not.toContain('- [x] Completed this week task');
        expect(thisWeekContent).not.toContain('- [-] Closed this week task');
        expect(thisWeekContent).not.toContain('- [x] This week task with description');
      });

      it('should leave Next Week section empty after transition', async() => {
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
      it('should preserve task descriptions during all transitions', async() => {
        await handler();

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        // Check This Week section (should have tasks from Next Week)
        expect(currentContent).toContain('- [ ] Next week task with description');
        expect(currentContent).toContain('  Next week description');

        // Check archive for archived This Week descriptions
        const archiveContent = readFileSync(join(testDir, 'archive.md'), 'utf-8');

        expect(archiveContent).toContain('- [x] This week task with description');
        expect(archiveContent).toContain('  This week description');
        expect(archiveContent).toContain('  Details here');
      });

      it('should handle tasks without descriptions correctly', async() => {
        await handler();

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        // Tasks without descriptions should still be moved properly
        expect(currentContent).toContain('- [ ] Unfinished this week task');
        expect(currentContent).toContain('- [ ] Next week task 1');
      });
    });

    describe('file operations', () => {
      it('should not modify backlog.md', async() => {
        const originalBacklog = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        await handler();

        const currentBacklog = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(currentBacklog).toBe(originalBacklog);
      });

      it('should preserve existing archive content', async() => {
        await handler();

        const archiveContent = readFileSync(join(testDir, 'archive.md'), 'utf-8');

        // Should still contain old archive entries
        expect(archiveContent).toContain('# Week of 2024-01-01');
        expect(archiveContent).toContain('- [x] Old completed task');
        expect(archiveContent).toContain('- [-] Old closed task');
        expect(archiveContent).toContain('# Week of 2023-12-25');
        expect(archiveContent).toContain('- [x] Very old task');
      });

      it('should maintain proper file structure and formatting', async() => {
        await handler();

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        // Should have proper markdown structure
        expect(currentContent.split('# This Week')).toHaveLength(2);
        expect(currentContent.split('# Next Week')).toHaveLength(2);

        // Should end with proper formatting
        expect(currentContent.endsWith('\n')).toBe(true);
      });
    });

    describe('date handling', () => {
      it('should use archive date for archive section title', async() => {
        spyOn(dateUtils, 'getArchiveWeekDate').mockReturnValue('2024-02-05');

        await handler();

        const archiveContent = readFileSync(join(testDir, 'archive.md'), 'utf-8');

        expect(archiveContent).toContain('# Week of 2024-02-05');
      });

      it('should use current date in commit message', async() => {
        spyOn(dateUtils, 'getCurrentDate').mockReturnValue('2024-02-12');

        await handler();

        expect(gitUtils.commitChanges).toHaveBeenNthCalledWith(2, 'Completed week transition to 2024-02-12');
      });

      it('should use correct dates in success message', async() => {
        spyOn(dateUtils, 'getArchiveWeekDate').mockReturnValue('2024-03-04');

        const result = await handler();

        expect(result.content[0].text).toContain('Successfully completed week transition. Archived week of 2024-03-04.');
        expect(result.content[0].text).toContain('# This Week');
      });
    });

    describe('git workflow', () => {
      it('should make pre-backup commit before changes when there are untracked files', async() => {
        await handler();

        // First commit should be pre-backup
        expect(gitUtils.commitChanges).toHaveBeenNthCalledWith(1, 'Pre-start-week backup');
      });

      it('should skip pre-backup commit when there are no untracked files', async() => {
        spyOn(gitUtils, 'hasUntrackedFiles').mockResolvedValue(false);

        await handler();

        // Should only make final commit
        expect(gitUtils.commitChanges).toHaveBeenCalledTimes(1);
        expect(gitUtils.commitChanges).toHaveBeenCalledWith('Completed week transition to 2024-01-15');
      });

      it('should make final commit after changes', async() => {
        await handler();

        // Second commit should be final
        expect(gitUtils.commitChanges).toHaveBeenNthCalledWith(2, 'Completed week transition to 2024-01-15');
      });

      it('should handle git failure during pre-backup', async() => {
        spyOn(gitUtils, 'commitChanges').mockRejectedValueOnce(new Error('Git pre-backup failed'));

        const result = await handler();

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error during week transition: Git pre-backup failed');

        // Should not make second commit if first fails
        expect(gitUtils.commitChanges).toHaveBeenCalledTimes(1);
      });

      it('should handle hasUntrackedFiles failure', async() => {
        spyOn(gitUtils, 'hasUntrackedFiles').mockRejectedValue(new Error('Git status failed'));

        const result = await handler();

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error during week transition: Git status failed');

        // Should not make any commits if hasUntrackedFiles fails
        expect(gitUtils.commitChanges).toHaveBeenCalledTimes(0);
      });

      it('should handle git failure during final commit', async() => {
        spyOn(gitUtils, 'commitChanges')
          .mockResolvedValueOnce(undefined) // Pre-backup succeeds
          .mockRejectedValueOnce(new Error('Git final commit failed')); // Final commit fails

        const result = await handler();

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error during week transition: Git final commit failed');

        // Should have attempted both commits
        expect(gitUtils.commitChanges).toHaveBeenCalledTimes(2);
      });
    });

    describe('error scenarios', () => {

      it('should handle missing This Week section', async() => {
        writeFileSync(join(testDir, 'current.md'), `# Next Week
- [ ] Task 2`);

        const result = await handler();

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Required sections not found in current.md');
      });

      it('should handle missing Next Week section', async() => {
        writeFileSync(join(testDir, 'current.md'), `# This Week
- [ ] Task 2`);

        const result = await handler();

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Required sections not found in current.md');
      });

      it('should handle file read/write errors gracefully', async() => {
        // Remove current.md to simulate file error
        rmSync(join(testDir, 'current.md'));

        const result = await handler();

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error during week transition:');
      });
    });

    describe('edge cases', () => {
      it('should handle empty sections gracefully', async() => {
        writeFileSync(join(testDir, 'current.md'), `# This Week

# Next Week
`);

        const result = await handler();

        expect(result).not.toHaveProperty('isError');

        // Should create proper structure even with empty sections
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('# This Week');
        expect(currentContent).toContain('# Next Week');
      });

      it('should handle sections with only completed tasks', async() => {
        writeFileSync(join(testDir, 'current.md'), `# This Week
- [x] All done task 1
- [-] All done task 2

# Next Week
- [ ] Future task`);

        await handler();

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const lines = currentContent.split('\n');

        // This Week should have the Next Week tasks (no incomplete tasks to carry over)
        const thisWeekStart = lines.findIndex(line => line === '# This Week');
        const nextWeekStart = lines.findIndex(line => line === '# Next Week');
        const thisWeekLines = lines.slice(thisWeekStart + 1, nextWeekStart);

        expect(thisWeekLines.join('\n')).toContain('- [ ] Future task');

        // Archive should contain the completed tasks
        const archiveContent = readFileSync(join(testDir, 'archive.md'), 'utf-8');

        expect(archiveContent).toContain('- [x] All done task 1');
        expect(archiveContent).toContain('- [-] All done task 2');
      });

      it('should handle sections with only unfinished tasks', async() => {
        writeFileSync(join(testDir, 'current.md'), `# This Week
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

    describe('idempotency', () => {
      it('should be idempotent when called multiple times in same week', async() => {
        // First call should complete normally
        const result1 = await handler();

        expect(result1.content[0].text).toContain('Successfully completed week transition. Archived week of 2024-01-08.');
        expect(result1.content[0].text).toContain('# This Week');

        // Reset git mocks for second call but keep date mocks
        const gitMocks = {
          hasUntrackedFiles: spyOn(gitUtils, 'hasUntrackedFiles').mockResolvedValue(true),
          commitChanges: spyOn(gitUtils, 'commitChanges').mockResolvedValue(),
        };

        // Clear previous git mock calls for clean counting
        gitMocks.hasUntrackedFiles.mockClear();
        gitMocks.commitChanges.mockClear();

        // Second call should detect existing archive and skip operations
        const result2 = await handler();

        expect(result2.content[0].text).toContain('Week of 2024-01-08 has already been archived. No changes made.');
        expect(result2.content[0].text).toContain('# This Week');

        // Should not make any git commits on second call
        expect(gitUtils.commitChanges).not.toHaveBeenCalled();
      });

      it('should detect existing archive section and skip processing', async() => {
        // Add the current week to archive before running
        const archiveContent = readFileSync(join(testDir, 'archive.md'), 'utf-8');
        const newArchiveContent = `${archiveContent  }\n\n# Week of 2024-01-08\n- [x] Already archived task`;

        writeFileSync(join(testDir, 'archive.md'), newArchiveContent);

        const result = await handler();

        expect(result.content[0].text).toContain('Week of 2024-01-08 has already been archived. No changes made.');
        expect(result.content[0].text).toContain('# This Week');
      });

      it('should return success message when skipping duplicate run', async() => {
        // Pre-populate archive with current week
        writeFileSync(join(testDir, 'archive.md'), `# Week of 2024-01-01
- [x] Old completed task

# Week of 2024-01-08
- [x] Current week task
- [ ] Another current task`);

        const result = await handler();

        expect(result.content[0].text).toContain('Week of 2024-01-08 has already been archived. No changes made.');
        expect(result.content[0].text).toContain('# This Week');
        expect(result).not.toHaveProperty('isError');
      });

      it('should not modify files when week already archived', async() => {
        // Store original file contents
        const originalCurrent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const originalBacklog = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        // Pre-populate archive with current week
        const originalArchive = readFileSync(join(testDir, 'archive.md'), 'utf-8');
        const prePopulatedArchive = `${originalArchive  }\n\n# Week of 2024-01-08\n- [x] Pre-existing task`;

        writeFileSync(join(testDir, 'archive.md'), prePopulatedArchive);

        await handler();

        // Files should remain unchanged
        expect(readFileSync(join(testDir, 'current.md'), 'utf-8')).toBe(originalCurrent);
        expect(readFileSync(join(testDir, 'backlog.md'), 'utf-8')).toBe(originalBacklog);
        expect(readFileSync(join(testDir, 'archive.md'), 'utf-8')).toBe(prePopulatedArchive);
      });

      it('should not make git commits when week already archived', async() => {
        // Pre-populate archive with current week
        const archiveContent = readFileSync(join(testDir, 'archive.md'), 'utf-8');

        writeFileSync(join(testDir, 'archive.md'), `${archiveContent  }\n\n# Week of 2024-01-08\n- [x] Already there`);

        await handler();

        // Should not have made any git commits
        expect(gitUtils.commitChanges).not.toHaveBeenCalled();
      });

      it('should handle missing archive file gracefully during idempotency check', async() => {
        // Remove archive file to simulate missing file
        rmSync(join(testDir, 'archive.md'));

        // Create empty archive file (this simulates what initializeWorkspace would do)
        writeFileSync(join(testDir, 'archive.md'), '# Archive\n');

        const result = await handler();

        // Should proceed with normal operation since no archive exists
        expect(result.content[0].text).toContain('Successfully completed week transition. Archived week of 2024-01-08.');
        expect(result.content[0].text).toContain('# This Week');
        expect(result).not.toHaveProperty('isError');
      });

      it('should proceed normally when different week is in archive', async() => {
        // Archive has different week, should proceed normally
        const result = await handler();

        expect(result.content[0].text).toContain('Successfully completed week transition. Archived week of 2024-01-08.');
        expect(result.content[0].text).toContain('# This Week');
        expect(result).not.toHaveProperty('isError');

        // Should have made commits for normal operation
        expect(gitUtils.commitChanges).toHaveBeenCalledTimes(2);
      });
    });

    describe('MCP response structure', () => {
      it('should return proper MCP structure for success', async() => {
        const result = await handler();

        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0]).toHaveProperty('text');
        expect(result).not.toHaveProperty('isError');
      });

      it('should return proper MCP structure for errors', async() => {
        // Force an error by removing current.md
        rmSync(join(testDir, 'current.md'));

        const result = await handler();

        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0]).toHaveProperty('text');
        expect(result.isError).toBe(true);
      });

      it('should return proper MCP structure for idempotent calls', async() => {
        // First call
        await handler();

        // Reset git mocks for second call but keep date mocks
        const gitMocks = {
          hasUntrackedFiles: spyOn(gitUtils, 'hasUntrackedFiles').mockResolvedValue(true),
          commitChanges: spyOn(gitUtils, 'commitChanges').mockResolvedValue(),
        };

        // Clear previous git mock calls for clean counting
        gitMocks.hasUntrackedFiles.mockClear();
        gitMocks.commitChanges.mockClear();

        // Second call should still return proper structure
        const result = await handler();

        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0]).toHaveProperty('text');
        expect(result).not.toHaveProperty('isError');
      });
    });
  });
});
