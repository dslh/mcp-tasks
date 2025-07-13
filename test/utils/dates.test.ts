/* global global */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { getCurrentDate, getArchiveWeekDate } from 'src/utils/dates';

describe('dates utilities', () => {
  describe('getCurrentDate', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const result = getCurrentDate();

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return today\'s date', () => {
      const result = getCurrentDate();
      const expected = new Date().toISOString().split('T')[0];

      expect(result).toBe(expected);
    });
  });

  describe('getArchiveWeekDate', () => {
    let originalDate: typeof Date;

    beforeEach(() => {
      originalDate = Date;
    });

    afterEach(() => {
      global.Date = originalDate;
    });

    function mockDate(dateString: string) {
      const mockDate = new Date(dateString);

      global.Date = class extends Date {
        constructor(...args) {
          if (args.length === 0) {
            super(mockDate.getTime());
          } else {
            super(...args);
          }
        }
      };
    }

    it('should return date in YYYY-MM-DD format', () => {
      mockDate('2024-01-15'); // Monday
      const result = getArchiveWeekDate();

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return Monday from current week when today is Monday', () => {
      mockDate('2024-01-15'); // Monday
      const result = getArchiveWeekDate();

      // Should be Monday of current week: 2024-01-08
      expect(result).toBe('2024-01-08');
    });

    it('should return Monday from current week when today is Tuesday', () => {
      mockDate('2024-01-16'); // Tuesday
      const result = getArchiveWeekDate();

      // Should be Monday of current week: 2024-01-08
      expect(result).toBe('2024-01-08');
    });

    it('should return Monday from current week when today is Wednesday', () => {
      mockDate('2024-01-17'); // Wednesday
      const result = getArchiveWeekDate();

      // Should be Monday of current week: 2024-01-08
      expect(result).toBe('2024-01-08');
    });

    it('should return Monday from current week when today is Thursday', () => {
      mockDate('2024-01-18'); // Thursday
      const result = getArchiveWeekDate();

      // Thursday: days to last Thursday = 0, so Jan 18 - 0 - 3 = Jan 15
      expect(result).toBe('2024-01-15');
    });

    it('should return Monday from current week when today is Friday', () => {
      mockDate('2024-01-19'); // Friday
      const result = getArchiveWeekDate();

      // Friday: days to last Thursday = 1, so Jan 19 - 1 - 3 = Jan 15
      expect(result).toBe('2024-01-15');
    });

    it('should return Monday from current week when today is Saturday', () => {
      mockDate('2024-01-20'); // Saturday
      const result = getArchiveWeekDate();

      // Saturday: days to last Thursday = 2, so Jan 20 - 2 - 3 = Jan 15
      expect(result).toBe('2024-01-15');
    });

    it('should return Monday from current week when today is Sunday', () => {
      mockDate('2024-01-21'); // Sunday
      const result = getArchiveWeekDate();

      // Sunday: days to last Thursday = 3, so Jan 21 - 3 - 3 = Jan 15
      expect(result).toBe('2024-01-15');
    });

    it('should handle month boundaries correctly', () => {
      mockDate('2024-02-05'); // Monday in February
      const result = getArchiveWeekDate();

      // Should be Monday from current week: 2024-01-29
      expect(result).toBe('2024-01-29');
    });

    it('should handle year boundaries correctly', () => {
      mockDate('2024-01-08'); // Monday in January
      const result = getArchiveWeekDate();

      // Should be Monday from current week: 2024-01-01
      expect(result).toBe('2024-01-01');
    });

    it('should handle leap year correctly', () => {
      mockDate('2024-03-04'); // Monday in March of leap year
      const result = getArchiveWeekDate();

      // Should be Monday from current week: 2024-02-26
      expect(result).toBe('2024-02-26');
    });
  });
});
