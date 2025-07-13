import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { setWorkingDirectory } from 'src/config';
import { initializeWorkspace } from 'src/utils/initializeWorkspace';
import * as gitUtils from 'src/utils/git';

describe('initializeWorkspace', () => {
  const testDir = '/tmp/mcp-tasks-test-initializeworkspace';

  beforeEach(() => {
    // Clean up and create fresh test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    setWorkingDirectory(testDir);

    // Set up mocks for this test
    spyOn(gitUtils, 'isGitRepo').mockResolvedValue(false);
    spyOn(gitUtils, 'initGitRepo').mockResolvedValue();
    spyOn(gitUtils, 'hasUntrackedFiles').mockResolvedValue(false);
    spyOn(gitUtils, 'commitChanges').mockResolvedValue();
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    // Clear all spies
    mock.restore();
  });

  describe('fresh workspace creation', () => {
    it('should create directory, initialize git, create files, and commit', async() => {
      // Remove test directory to simulate fresh workspace
      rmSync(testDir, { recursive: true });

      gitUtils.isGitRepo.mockResolvedValue(false);
      gitUtils.hasUntrackedFiles.mockResolvedValue(true);

      await initializeWorkspace();

      // Verify directory was created
      expect(existsSync(testDir)).toBe(true);

      // Verify git operations
      expect(gitUtils.isGitRepo).toHaveBeenCalledTimes(1);
      expect(gitUtils.initGitRepo).toHaveBeenCalledTimes(1);
      expect(gitUtils.hasUntrackedFiles).toHaveBeenCalledTimes(1);
      expect(gitUtils.commitChanges).toHaveBeenCalledWith('Changes since last startup');

      // Verify files were created with correct templates
      expect(existsSync(join(testDir, 'current.md'))).toBe(true);
      expect(existsSync(join(testDir, 'backlog.md'))).toBe(true);
      expect(existsSync(join(testDir, 'archive.md'))).toBe(true);
    });

    it('should create files with correct templates', async() => {
      gitUtils.isGitRepo.mockResolvedValue(true);
      gitUtils.hasUntrackedFiles.mockResolvedValue(false);

      await initializeWorkspace();

      const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
      const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');
      const archiveContent = readFileSync(join(testDir, 'archive.md'), 'utf-8');

      expect(currentContent).toBe('# This Week\n\n# Next Week\n');
      expect(backlogContent).toBe('# Backlog\n');
      expect(archiveContent).toBe('# Archive\n');
    });
  });

  describe('existing directory scenarios', () => {
    it('should initialize git if directory exists but not a git repo', async() => {
      gitUtils.isGitRepo.mockResolvedValue(false);
      gitUtils.hasUntrackedFiles.mockResolvedValue(true);

      await initializeWorkspace();

      expect(gitUtils.isGitRepo).toHaveBeenCalledTimes(1);
      expect(gitUtils.initGitRepo).toHaveBeenCalledTimes(1);
      expect(gitUtils.commitChanges).toHaveBeenCalledWith('Changes since last startup');
    });

    it('should skip git initialization if already a git repo', async() => {
      gitUtils.isGitRepo.mockResolvedValue(true);
      gitUtils.hasUntrackedFiles.mockResolvedValue(false);

      await initializeWorkspace();

      expect(gitUtils.isGitRepo).toHaveBeenCalledTimes(1);
      expect(gitUtils.initGitRepo).not.toHaveBeenCalled();
      expect(gitUtils.commitChanges).not.toHaveBeenCalled();
    });

    it('should commit if git repo exists but has untracked files', async() => {
      gitUtils.isGitRepo.mockResolvedValue(true);
      gitUtils.hasUntrackedFiles.mockResolvedValue(true);

      await initializeWorkspace();

      expect(gitUtils.initGitRepo).not.toHaveBeenCalled();
      expect(gitUtils.commitChanges).toHaveBeenCalledWith('Changes since last startup');
    });
  });

  describe('file creation scenarios', () => {
    it('should create only missing files', async() => {
      // Create only current.md
      writeFileSync(join(testDir, 'current.md'), 'existing content');

      gitUtils.isGitRepo.mockResolvedValue(true);
      gitUtils.hasUntrackedFiles.mockResolvedValue(false);

      await initializeWorkspace();

      // Verify existing file wasn't overwritten
      const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(currentContent).toBe('existing content');

      // Verify missing files were created
      expect(existsSync(join(testDir, 'backlog.md'))).toBe(true);
      expect(existsSync(join(testDir, 'archive.md'))).toBe(true);
    });

    it('should not overwrite existing files', async() => {
      // Create all files with custom content
      writeFileSync(join(testDir, 'current.md'), 'custom current');
      writeFileSync(join(testDir, 'backlog.md'), 'custom backlog');
      writeFileSync(join(testDir, 'archive.md'), 'custom archive');

      gitUtils.isGitRepo.mockResolvedValue(true);
      gitUtils.hasUntrackedFiles.mockResolvedValue(false);

      await initializeWorkspace();

      // Verify no files were overwritten
      expect(readFileSync(join(testDir, 'current.md'), 'utf-8')).toBe('custom current');
      expect(readFileSync(join(testDir, 'backlog.md'), 'utf-8')).toBe('custom backlog');
      expect(readFileSync(join(testDir, 'archive.md'), 'utf-8')).toBe('custom archive');
    });

    it('should handle partial file existence', async() => {
      // Create only backlog.md
      writeFileSync(join(testDir, 'backlog.md'), 'existing backlog');

      gitUtils.isGitRepo.mockResolvedValue(true);
      gitUtils.hasUntrackedFiles.mockResolvedValue(true);

      await initializeWorkspace();

      // Verify existing file preserved
      expect(readFileSync(join(testDir, 'backlog.md'), 'utf-8')).toBe('existing backlog');

      // Verify missing files created with templates
      expect(readFileSync(join(testDir, 'current.md'), 'utf-8')).toBe('# This Week\n\n# Next Week\n');
      expect(readFileSync(join(testDir, 'archive.md'), 'utf-8')).toBe('# Archive\n');

      expect(gitUtils.commitChanges).toHaveBeenCalledWith('Changes since last startup');
    });
  });

  describe('git operation sequences', () => {

    it('should not commit if no untracked files', async() => {
      gitUtils.isGitRepo.mockResolvedValue(false);
      gitUtils.hasUntrackedFiles.mockResolvedValue(false);

      await initializeWorkspace();

      expect(gitUtils.initGitRepo).toHaveBeenCalledTimes(1);
      expect(gitUtils.hasUntrackedFiles).toHaveBeenCalledTimes(1);
      expect(gitUtils.commitChanges).not.toHaveBeenCalled();
    });

    it('should handle git repo check without initialization if already exists', async() => {
      gitUtils.isGitRepo.mockResolvedValue(true);
      gitUtils.hasUntrackedFiles.mockResolvedValue(false);

      await initializeWorkspace();

      expect(gitUtils.isGitRepo).toHaveBeenCalledTimes(1);
      expect(gitUtils.initGitRepo).not.toHaveBeenCalled();
      expect(gitUtils.hasUntrackedFiles).toHaveBeenCalledTimes(1);
      expect(gitUtils.commitChanges).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should propagate git initialization errors', async() => {
      gitUtils.isGitRepo.mockResolvedValue(false);
      gitUtils.initGitRepo.mockRejectedValue(new Error('Git init failed'));

      await expect(initializeWorkspace()).rejects.toThrow('Git init failed');
    });

    it('should propagate git repo check errors', async() => {
      gitUtils.isGitRepo.mockRejectedValue(new Error('Git check failed'));

      await expect(initializeWorkspace()).rejects.toThrow('Git check failed');
    });

    it('should propagate commit errors', async() => {
      gitUtils.isGitRepo.mockResolvedValue(true);
      gitUtils.hasUntrackedFiles.mockResolvedValue(true);
      gitUtils.commitChanges.mockRejectedValue(new Error('Commit failed'));

      await expect(initializeWorkspace()).rejects.toThrow('Commit failed');
    });

    it('should propagate untracked files check errors', async() => {
      gitUtils.isGitRepo.mockResolvedValue(true);
      gitUtils.hasUntrackedFiles.mockRejectedValue(new Error('Status check failed'));

      await expect(initializeWorkspace()).rejects.toThrow('Status check failed');
    });
  });

  describe('directory creation', () => {
    it('should create nested directories if needed', async() => {
      const nestedDir = '/tmp/mcp-tasks-test-nested/deep/path';

      setWorkingDirectory(nestedDir);

      gitUtils.isGitRepo.mockResolvedValue(true);
      gitUtils.hasUntrackedFiles.mockResolvedValue(false);

      await initializeWorkspace();

      expect(existsSync(nestedDir)).toBe(true);
      expect(existsSync(join(nestedDir, 'current.md'))).toBe(true);

      // Clean up nested directory
      rmSync('/tmp/mcp-tasks-test-nested', { recursive: true });
    });

    it('should handle existing directory gracefully', async() => {
      // Directory already exists from beforeEach
      gitUtils.isGitRepo.mockResolvedValue(true);
      gitUtils.hasUntrackedFiles.mockResolvedValue(false);

      // Should not throw when directory already exists
      await initializeWorkspace();

      expect(existsSync(testDir)).toBe(true);
    });
  });

  describe('file content verification', () => {
    it('should create current.md with correct template structure', async() => {
      gitUtils.isGitRepo.mockResolvedValue(true);
      gitUtils.hasUntrackedFiles.mockResolvedValue(false);

      await initializeWorkspace();

      const content = readFileSync(join(testDir, 'current.md'), 'utf-8');
      const lines = content.split('\n');

      expect(lines[0]).toBe('# This Week');
      expect(lines[1]).toBe('');
      expect(lines[2]).toBe('# Next Week');
      expect(lines[3]).toBe('');
    });

    it('should create simple templates for backlog and archive', async() => {
      gitUtils.isGitRepo.mockResolvedValue(true);
      gitUtils.hasUntrackedFiles.mockResolvedValue(false);

      await initializeWorkspace();

      const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');
      const archiveContent = readFileSync(join(testDir, 'archive.md'), 'utf-8');

      expect(backlogContent).toBe('# Backlog\n');
      expect(archiveContent).toBe('# Archive\n');
    });
  });
});
