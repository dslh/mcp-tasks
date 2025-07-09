import { describe, it, expect, beforeEach } from 'bun:test';
import { setWorkingDirectory, getFilePath } from 'src/config';

describe('getFilePath', () => {
  beforeEach(() => {
    setWorkingDirectory('/tmp/test-workspace');
  });

  it('should return correct path for current file', () => {
    expect(getFilePath('current')).toBe('/tmp/test-workspace/current.md');
  });

  it('should return correct path for backlog file', () => {
    expect(getFilePath('backlog')).toBe('/tmp/test-workspace/backlog.md');
  });

  it('should return correct path for archive file', () => {
    expect(getFilePath('archive')).toBe('/tmp/test-workspace/archive.md');
  });

  it('should throw error for invalid file name', () => {
    expect(() => getFilePath('invalid' as any)).toThrow('Unknown file: invalid');
  });

  it('should use different working directories correctly', () => {
    setWorkingDirectory('/Users/test/workspace1');
    expect(getFilePath('current')).toBe('/Users/test/workspace1/current.md');

    setWorkingDirectory('/Users/test/workspace2');
    expect(getFilePath('current')).toBe('/Users/test/workspace2/current.md');
  });

  it('should handle working directory with trailing slash', () => {
    setWorkingDirectory('/tmp/test-workspace/');
    expect(getFilePath('current')).toBe('/tmp/test-workspace/current.md');
  });

  it('should handle relative working directory', () => {
    setWorkingDirectory('workspace');
    expect(getFilePath('current')).toBe('workspace/current.md');
  });
});
