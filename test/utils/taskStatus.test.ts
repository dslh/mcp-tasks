import { describe, expect, test } from 'bun:test';
import {
  getStatusChar,
  parseStatusChar,
  getTaskCheckbox,
  isFinishedStatus,
  getStatusDisplay,
  isValidStatus,
  type TaskStatus,
} from '../../src/utils/taskStatus';

describe('taskStatus utilities', () => {
  describe('getStatusChar', () => {
    test('should return correct character for each status', () => {
      expect(getStatusChar('new')).toBe(' ');
      expect(getStatusChar('completed')).toBe('x');
      expect(getStatusChar('closed')).toBe('-');
    });
  });

  describe('parseStatusChar', () => {
    test('should parse character to correct status', () => {
      expect(parseStatusChar(' ')).toBe('new');
      expect(parseStatusChar('x')).toBe('completed');
      expect(parseStatusChar('-')).toBe('closed');
    });

    test('should default to new for unknown characters', () => {
      expect(parseStatusChar('?')).toBe('new');
      expect(parseStatusChar('')).toBe('new');
    });
  });

  describe('getTaskCheckbox', () => {
    test('should return correct checkbox string for each status', () => {
      expect(getTaskCheckbox('new')).toBe('- [ ]');
      expect(getTaskCheckbox('completed')).toBe('- [x]');
      expect(getTaskCheckbox('closed')).toBe('- [-]');
    });
  });

  describe('isFinishedStatus', () => {
    test('should correctly identify finished statuses', () => {
      expect(isFinishedStatus('completed')).toBe(true);
      expect(isFinishedStatus('closed')).toBe(true);
      expect(isFinishedStatus('new')).toBe(false);
    });
  });

  describe('getStatusDisplay', () => {
    test('should return correct display string for each status', () => {
      expect(getStatusDisplay('new')).toBe('new [ ]');
      expect(getStatusDisplay('completed')).toBe('completed [x]');
      expect(getStatusDisplay('closed')).toBe('closed [-]');
    });
  });

  describe('isValidStatus', () => {
    test('should validate correct status strings', () => {
      expect(isValidStatus('new')).toBe(true);
      expect(isValidStatus('completed')).toBe(true);
      expect(isValidStatus('closed')).toBe(true);
    });

    test('should reject invalid status strings', () => {
      expect(isValidStatus('invalid')).toBe(false);
      expect(isValidStatus('')).toBe(false);
      expect(isValidStatus('pending')).toBe(false);
    });
  });

  describe('type consistency', () => {
    test('getStatusChar and parseStatusChar should be inverse functions', () => {
      const statuses: TaskStatus[] = ['new', 'completed', 'closed'];

      for (const status of statuses) {
        const char = getStatusChar(status);
        const parsedStatus = parseStatusChar(char);

        expect(parsedStatus).toBe(status);
      }
    });
  });
});
