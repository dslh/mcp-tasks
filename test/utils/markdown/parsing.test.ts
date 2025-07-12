import { describe, it, expect } from 'bun:test';
import { parseMarkdownSections, getTaskDescriptionLines } from 'src/utils/markdown/parsing';

describe('parseMarkdownSections', () => {
  it('should parse simple markdown with multiple sections', () => {
    const content = `# First Section
Line 1
Line 2

# Second Section
Line 3
Line 4`;

    const sections = parseMarkdownSections(content);

    expect(sections).toHaveLength(2);

    expect(sections[0]).toEqual({
      title: 'First Section',
      content: ['Line 1', 'Line 2', ''],
      startLine: 0,
      endLine: 3,
    });

    expect(sections[1]).toEqual({
      title: 'Second Section',
      content: ['Line 3', 'Line 4'],
      startLine: 4,
      endLine: 6,
    });
  });

  it('should handle empty content', () => {
    const sections = parseMarkdownSections('');

    expect(sections).toHaveLength(0);
  });

  it('should handle content without sections', () => {
    const content = `Some text
More text`;

    const sections = parseMarkdownSections(content);

    expect(sections).toHaveLength(0);
  });

  it('should handle single section', () => {
    const content = `# Only Section
Content here`;

    const sections = parseMarkdownSections(content);

    expect(sections).toHaveLength(1);
    expect(sections[0]).toEqual({
      title: 'Only Section',
      content: ['Content here'],
      startLine: 0,
      endLine: 1,
    });
  });

  it('should handle section with no content', () => {
    const content = '# Empty Section';

    const sections = parseMarkdownSections(content);

    expect(sections).toHaveLength(1);
    expect(sections[0]).toEqual({
      title: 'Empty Section',
      content: [],
      startLine: 0,
      endLine: 0,
    });
  });

  it('should trim whitespace from section titles', () => {
    const content = `#   Spaced Title   
Content`;

    const sections = parseMarkdownSections(content);

    expect(sections[0].title).toBe('Spaced Title');
  });

  it('should handle realistic task content', () => {
    const content = `# This Week
- [ ] Complete project setup
  Set up development environment
  Configure build tools

- [x] Review documentation

# Next Week
- [ ] Start implementation
  Begin with core features`;

    const sections = parseMarkdownSections(content);

    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('This Week');
    expect(sections[1].title).toBe('Next Week');
    expect(sections[0].content).toContain('- [ ] Complete project setup');
    expect(sections[0].content).toContain('  Set up development environment');
  });
});

describe('getTaskDescriptionLines', () => {
  it('should find description lines after a task', () => {
    const lines = [
      '- [ ] Main task',
      '  First description line',
      '  Second description line',
      '',
      '- [ ] Next task',
    ];

    const descriptionLines = getTaskDescriptionLines(lines, 1);

    expect(descriptionLines).toEqual([
      '  First description line',
      '  Second description line',
    ]);
  });

  it('should return empty array when no description lines', () => {
    const lines = [
      '- [ ] Main task',
      '- [ ] Next task',
    ];

    const descriptionLines = getTaskDescriptionLines(lines, 1);

    expect(descriptionLines).toEqual([]);
  });

  it('should stop at empty lines', () => {
    const lines = [
      '- [ ] Main task',
      '  Description line',
      '',
      '  This should not be included',
    ];

    const descriptionLines = getTaskDescriptionLines(lines, 1);

    expect(descriptionLines).toEqual(['  Description line']);
  });

  it('should stop at non-indented lines', () => {
    const lines = [
      '- [ ] Main task',
      '  Description line',
      'Non-indented line',
      '  This should not be included',
    ];

    const descriptionLines = getTaskDescriptionLines(lines, 1);

    expect(descriptionLines).toEqual(['  Description line']);
  });

  it('should handle start index at end of array', () => {
    const lines = ['- [ ] Main task'];

    const descriptionLines = getTaskDescriptionLines(lines, 1);

    expect(descriptionLines).toEqual([]);
  });

  it('should handle start index beyond array length', () => {
    const lines = ['- [ ] Main task'];

    const descriptionLines = getTaskDescriptionLines(lines, 5);

    expect(descriptionLines).toEqual([]);
  });
});
