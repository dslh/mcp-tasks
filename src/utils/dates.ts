export function getCurrentDate(): string {
  const now = new Date();

  return now.toISOString().split('T')[0];
}

/**
 * Returns the Monday date of the week that should be archived during week transition.
 *
 * This calculates the Monday of the week that was "last week" two weeks ago.
 * The logic finds the last Thursday, then goes back 10 more days to get the
 * Monday of the week to archive.
 *
 * @returns Date string in YYYY-MM-DD format
 */
export function getArchiveWeekDate(): string {
  const today = new Date();
  const currentDay = today.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const daysToLastThursday = currentDay >= 4 ? currentDay - 4 : currentDay + 3;

  // Get Monday of the week to archive: today - daysToLastThursday - 10
  const archiveMonday = new Date(today);

  archiveMonday.setDate(today.getDate() - daysToLastThursday - 10);

  // Format as YYYY-MM-DD
  const year = archiveMonday.getFullYear();
  const month = String(archiveMonday.getMonth() + 1).padStart(2, '0');
  const day = String(archiveMonday.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
