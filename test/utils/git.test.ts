import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { setWorkingDirectory } from 'src/config';
import { isGitRepo, initGitRepo, hasUntrackedFiles, commitChanges } from 'src/utils/git';

// Mock child_process module
const mockSpawn = mock(() => {
  const mockChild = {
    stdout: {
      on: mock((event: string, callback: (data: Buffer) => void) => {
        if (event === 'data') {
          mockChild._stdoutCallback = callback;
        }
      }),
    },
    stderr: {
      on: mock((event: string, callback: (data: Buffer) => void) => {
        if (event === 'data') {
          mockChild._stderrCallback = callback;
        }
      }),
    },
    on: mock((event: string, callback: (code: number) => void) => {
      if (event === 'close') {
        mockChild._closeCallback = callback;
      }
    }),
    _stdoutCallback: null as ((data: Buffer) => void) | null,
    _stderrCallback: null as ((data: Buffer) => void) | null,
    _closeCallback: null as ((code: number) => void) | null,
    _emitStdout: (data: string) => {
      if (mockChild._stdoutCallback) {
        mockChild._stdoutCallback(Buffer.from(data));
      }
    },
    _emitStderr: (data: string) => {
      if (mockChild._stderrCallback) {
        mockChild._stderrCallback(Buffer.from(data));
      }
    },
    _emitClose: (code: number) => {
      if (mockChild._closeCallback) {
        mockChild._closeCallback(code);
      }
    },
  };

  return mockChild;
});

mock.module('child_process', () => ({
  spawn: mockSpawn,
}));

describe('git utilities', () => {
  beforeEach(() => {
    setWorkingDirectory('/test/directory');
    mockSpawn.mockClear();
  });

  afterEach(() => {
    // Clear all mocks
    mock.restore();
  });

  describe('isGitRepo', () => {
    it('should return true when git rev-parse succeeds', async() => {
      mockSpawn.mockImplementationOnce(() => {
        const mockChild = {
          stdout: { on: mock() },
          stderr: { on: mock() },
          on: mock((event: string, callback: (code: number) => void) => {
            if (event === 'close') {
              // Simulate successful git command
              setTimeout(() => callback(0), 1);
            }
          }),
        };

        return mockChild;
      });

      const result = await isGitRepo();

      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--git-dir'],
        { cwd: '/test/directory', stdio: ['pipe', 'pipe', 'pipe'] },
      );
    });

    it('should return false when git rev-parse fails', async() => {
      mockSpawn.mockImplementationOnce(() => {
        const mockChild = {
          stdout: { on: mock() },
          stderr: { on: mock() },
          on: mock((event: string, callback: (code: number) => void) => {
            if (event === 'close') {
              // Simulate failed git command
              setTimeout(() => callback(128), 1);
            }
          }),
        };

        return mockChild;
      });

      const result = await isGitRepo();

      expect(result).toBe(false);
    });

    it('should return false when spawn throws an error', async() => {
      mockSpawn.mockImplementationOnce(() => {
        throw new Error('Command not found');
      });

      const result = await isGitRepo();

      expect(result).toBe(false);
    });
  });

  describe('initGitRepo', () => {
    it('should execute git init and config commands', async() => {
      let callCount = 0;

      mockSpawn.mockImplementation(() => {
        callCount++;
        const mockChild = {
          stdout: { on: mock() },
          stderr: { on: mock() },
          on: mock((event: string, callback: (code: number) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 1);
            }
          }),
        };

        return mockChild;
      });

      await initGitRepo();

      expect(mockSpawn).toHaveBeenCalledTimes(3);
      expect(mockSpawn).toHaveBeenNthCalledWith(
        1,
        'git',
        ['init'],
        { cwd: '/test/directory', stdio: ['pipe', 'pipe', 'pipe'] },
      );
      expect(mockSpawn).toHaveBeenNthCalledWith(
        2,
        'git',
        ['config', 'user.email', 'mcp-tasks@example.com'],
        { cwd: '/test/directory', stdio: ['pipe', 'pipe', 'pipe'] },
      );
      expect(mockSpawn).toHaveBeenNthCalledWith(
        3,
        'git',
        ['config', 'user.name', 'MCP Tasks Server'],
        { cwd: '/test/directory', stdio: ['pipe', 'pipe', 'pipe'] },
      );
    });

    it('should throw error when git init fails', async() => {
      mockSpawn.mockImplementationOnce(() => {
        const mockChild = {
          stdout: { on: mock() },
          stderr: {
            on: mock((event: string, callback: (data: Buffer) => void) => {
              if (event === 'data') {
                setTimeout(() => callback(Buffer.from('fatal: not a git repository')), 1);
              }
            }),
          },
          on: mock((event: string, callback: (code: number) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(1), 2);
            }
          }),
        };

        return mockChild;
      });

      await expect(initGitRepo()).rejects.toThrow('Command failed with code 1');
    });

    it('should throw error when git config fails', async() => {
      let callCount = 0;

      mockSpawn.mockImplementation(() => {
        callCount++;
        const mockChild = {
          stdout: { on: mock() },
          stderr: {
            on: mock((event: string, callback: (data: Buffer) => void) => {
              if (event === 'data' && callCount === 2) {
                setTimeout(() => callback(Buffer.from('error: could not set config')), 1);
              }
            }),
          },
          on: mock((event: string, callback: (code: number) => void) => {
            if (event === 'close') {
              const exitCode = callCount === 2 ? 1 : 0;

              setTimeout(() => callback(exitCode), 2);
            }
          }),
        };

        return mockChild;
      });

      await expect(initGitRepo()).rejects.toThrow('Command failed with code 1');
    });
  });

  describe('hasUntrackedFiles', () => {
    it('should return true when git status shows changes', async() => {
      mockSpawn.mockImplementationOnce(() => {
        const mockChild = {
          stdout: {
            on: mock((event: string, callback: (data: Buffer) => void) => {
              if (event === 'data') {
                setTimeout(() => callback(Buffer.from('?? untracked.txt\n M modified.txt\n')), 1);
              }
            }),
          },
          stderr: { on: mock() },
          on: mock((event: string, callback: (code: number) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 2);
            }
          }),
        };

        return mockChild;
      });

      const result = await hasUntrackedFiles();

      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['status', '--porcelain'],
        { cwd: '/test/directory', stdio: ['pipe', 'pipe', 'pipe'] },
      );
    });

    it('should return false when git status shows no changes', async() => {
      mockSpawn.mockImplementationOnce(() => {
        const mockChild = {
          stdout: {
            on: mock((event: string, callback: (data: Buffer) => void) => {
              if (event === 'data') {
                setTimeout(() => callback(Buffer.from('')), 1);
              }
            }),
          },
          stderr: { on: mock() },
          on: mock((event: string, callback: (code: number) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 2);
            }
          }),
        };

        return mockChild;
      });

      const result = await hasUntrackedFiles();

      expect(result).toBe(false);
    });

    it('should return false when git status fails', async() => {
      mockSpawn.mockImplementationOnce(() => {
        const mockChild = {
          stdout: { on: mock() },
          stderr: { on: mock() },
          on: mock((event: string, callback: (code: number) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(128), 1);
            }
          }),
        };

        return mockChild;
      });

      const result = await hasUntrackedFiles();

      expect(result).toBe(false);
    });

    it('should handle whitespace-only output correctly', async() => {
      mockSpawn.mockImplementationOnce(() => {
        const mockChild = {
          stdout: {
            on: mock((event: string, callback: (data: Buffer) => void) => {
              if (event === 'data') {
                setTimeout(() => callback(Buffer.from('   \n  \n')), 1);
              }
            }),
          },
          stderr: { on: mock() },
          on: mock((event: string, callback: (code: number) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 2);
            }
          }),
        };

        return mockChild;
      });

      const result = await hasUntrackedFiles();

      expect(result).toBe(false);
    });
  });

  describe('commitChanges', () => {
    it('should execute git add and commit commands', async() => {
      let callCount = 0;

      mockSpawn.mockImplementation(() => {
        callCount++;
        const mockChild = {
          stdout: { on: mock() },
          stderr: { on: mock() },
          on: mock((event: string, callback: (code: number) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 1);
            }
          }),
        };

        return mockChild;
      });

      await commitChanges('Test commit message');

      expect(mockSpawn).toHaveBeenCalledTimes(2);
      expect(mockSpawn).toHaveBeenNthCalledWith(
        1,
        'git',
        ['add', '.'],
        { cwd: '/test/directory', stdio: ['pipe', 'pipe', 'pipe'] },
      );
      expect(mockSpawn).toHaveBeenNthCalledWith(
        2,
        'git',
        ['commit', '-m', 'Test commit message'],
        { cwd: '/test/directory', stdio: ['pipe', 'pipe', 'pipe'] },
      );
    });

    it('should throw error when git add fails', async() => {
      mockSpawn.mockImplementationOnce(() => {
        const mockChild = {
          stdout: { on: mock() },
          stderr: {
            on: mock((event: string, callback: (data: Buffer) => void) => {
              if (event === 'data') {
                setTimeout(() => callback(Buffer.from('fatal: not a git repository')), 1);
              }
            }),
          },
          on: mock((event: string, callback: (code: number) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(128), 2);
            }
          }),
        };

        return mockChild;
      });

      await expect(commitChanges('Test message')).rejects.toThrow('Command failed with code 128');
    });

    it('should throw error when git commit fails', async() => {
      let callCount = 0;

      mockSpawn.mockImplementation(() => {
        callCount++;
        const mockChild = {
          stdout: { on: mock() },
          stderr: {
            on: mock((event: string, callback: (data: Buffer) => void) => {
              if (event === 'data' && callCount === 2) {
                setTimeout(() => callback(Buffer.from('nothing to commit')), 1);
              }
            }),
          },
          on: mock((event: string, callback: (code: number) => void) => {
            if (event === 'close') {
              const exitCode = callCount === 2 ? 1 : 0;

              setTimeout(() => callback(exitCode), 2);
            }
          }),
        };

        return mockChild;
      });

      await expect(commitChanges('Test message')).rejects.toThrow('Command failed with code 1');
    });

    it('should handle commit messages with special characters', async() => {
      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stdout: { on: mock() },
          stderr: { on: mock() },
          on: mock((event: string, callback: (code: number) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 1);
            }
          }),
        };

        return mockChild;
      });

      await commitChanges('Test: "quotes" & special chars!');

      expect(mockSpawn).toHaveBeenNthCalledWith(
        2,
        'git',
        ['commit', '-m', 'Test: "quotes" & special chars!'],
        { cwd: '/test/directory', stdio: ['pipe', 'pipe', 'pipe'] },
      );
    });
  });

  describe('error handling', () => {
    it('should handle stderr data correctly', async() => {
      mockSpawn.mockImplementationOnce(() => {
        const mockChild = {
          stdout: { on: mock() },
          stderr: {
            on: mock((event: string, callback: (data: Buffer) => void) => {
              if (event === 'data') {
                setTimeout(() => callback(Buffer.from('error: some git error')), 1);
              }
            }),
          },
          on: mock((event: string, callback: (code: number) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(1), 2);
            }
          }),
        };

        return mockChild;
      });

      await expect(isGitRepo()).resolves.toBe(false);
    });

    it('should handle stdout data correctly', async() => {
      mockSpawn.mockImplementationOnce(() => {
        const mockChild = {
          stdout: {
            on: mock((event: string, callback: (data: Buffer) => void) => {
              if (event === 'data') {
                setTimeout(() => callback(Buffer.from('.git\n')), 1);
              }
            }),
          },
          stderr: { on: mock() },
          on: mock((event: string, callback: (code: number) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 2);
            }
          }),
        };

        return mockChild;
      });

      const result = await isGitRepo();

      expect(result).toBe(true);
    });
  });
});
