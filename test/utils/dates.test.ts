/* global global */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { getCurrentDate, getArchiveWeekDate } from 'src/utils/dates';

// eslint-disable-next-line max-lines-per-function
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

  // eslint-disable-next-line max-lines-per-function
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

    it('should return Monday from 2 weeks ago when today is Monday', () => {
      mockDate('2024-01-15'); // Monday
      const result = getArchiveWeekDate();

      // Should be Monday of week from 2 weeks ago: 2024-01-01
      expect(result).toBe('2024-01-01');
    });

    it('should return Monday from 2 weeks ago when today is Tuesday', () => {
      mockDate('2024-01-16'); // Tuesday
      const result = getArchiveWeekDate();

      // Should be Monday of week from 2 weeks ago: 2024-01-01
      expect(result).toBe('2024-01-01');
    });

    it('should return Monday from 2 weeks ago when today is Wednesday', () => {
      mockDate('2024-01-17'); // Wednesday
      const result = getArchiveWeekDate();

      // Should be Monday of week from 2 weeks ago: 2024-01-01
      expect(result).toBe('2024-01-01');
    });

    it('should return Monday from 2 weeks ago when today is Thursday', () => {
      mockDate('2024-01-18'); // Thursday
      const result = getArchiveWeekDate();

      // Thursday: days to last Thursday = 0, so Jan 18 - 0 - 10 = Jan 8
      expect(result).toBe('2024-01-08');
    });

    it('should return Monday from 2 weeks ago when today is Friday', () => {
      mockDate('2024-01-19'); // Friday
      const result = getArchiveWeekDate();

      // Friday: days to last Thursday = 1, so Jan 19 - 1 - 10 = Jan 8
      expect(result).toBe('2024-01-08');
    });

    it('should return Monday from 2 weeks ago when today is Saturday', () => {
      mockDate('2024-01-20'); // Saturday
      const result = getArchiveWeekDate();

      // Saturday: days to last Thursday = 2, so Jan 20 - 2 - 10 = Jan 8
      expect(result).toBe('2024-01-08');
    });

    it('should return Monday from 2 weeks ago when today is Sunday', () => {
      mockDate('2024-01-21'); // Sunday
      const result = getArchiveWeekDate();

      // Sunday: days to last Thursday = 3, so Jan 21 - 3 - 10 = Jan 8
      expect(result).toBe('2024-01-08');
    });

    it('should handle month boundaries correctly', () => {
      mockDate('2024-02-05'); // Monday in February
      const result = getArchiveWeekDate();

      // Should be Monday from 2 weeks ago: 2024-01-22
      expect(result).toBe('2024-01-22');
    });

    it('should handle year boundaries correctly', () => {
      mockDate('2024-01-08'); // Monday in January
      const result = getArchiveWeekDate();

      // Should be Monday from 2 weeks ago: 2023-12-25
      expect(result).toBe('2023-12-25');
    });

    it('should handle leap year correctly', () => {
      mockDate('2024-03-04'); // Monday in March of leap year
      const result = getArchiveWeekDate();

      // Should be Monday from 2 weeks ago: 2024-02-19
      expect(result).toBe('2024-02-19');
    });
  });
});
