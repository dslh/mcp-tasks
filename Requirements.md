# Weekly Task Management MCP Server - Requirements Document

## Overview

This document specifies the requirements for a Model Context Protocol (MCP) server that manages a personal weekly task management system. The system is designed to maintain small, agent-readable files that support a rolling weekly workflow.

## System Architecture

### File Structure

The system manages three markdown files:

1. **`current.md`** - Active tasks across three time periods
2. **`backlog.md`** - Future tasks with creation dates
3. **`archive.md`** - Completed weekly sections

### Data Storage Format

#### Current Tasks File (`current.md`)
```markdown
# Last Week
- [x] Completed task
- [-] Closed/abandoned task
  Some description text for context
- [ ] Unfinished task

# This Week  
- [ ] Active task
- [x] Completed task
  Task description here

# Next Week
- [ ] Planned task
```

#### Backlog File (`backlog.md`)
```markdown
# Backlog

- [ ] Task added on 2024-03-15
  Description of the backlog task
- [ ] Another backlog task added on 2024-03-10
```

#### Archive File (`archive.md`)
```markdown
# Week of 2024-03-04
- [x] Completed task from that week
- [-] Closed task from that week

# Week of 2024-02-26
- [x] Another completed task
```

### Task Format Specifications

- **Incomplete tasks**: `- [ ] Task description`
- **Completed tasks**: `- [x] Task description` 
- **Closed/abandoned tasks**: `- [-] Task description`
- **Task descriptions**: Indented text under the main task item
- **Backlog dates**: Tasks in backlog include creation date in the task text

## MCP Tools/Commands

### 1. `add_task`
**Purpose**: Add a new task to the system

**Parameters**:
- `task_text` (string): The task description
- `target` (enum): Where to add the task - "backlog", "current_week", "next_week"
- `description` (string, optional): Additional task details

**Behavior**:
- If target is "backlog", append current date to task text
- Add as incomplete task (`[ ]`) by default
- If description provided, add as indented text below task

### 2. `edit_task`
**Purpose**: Modify an existing task's text or description

**Parameters**:
- `task_identifier` (string): Text to match against existing tasks (see Task Identification Strategy)
- `new_text` (string, optional): Updated task text
- `new_description` (string, optional): Updated description

**Behavior**:
- Search across all files for matching task
- Update specified fields
- Preserve task completion status

### 3. `move_task`
**Purpose**: Move a task between backlog, current week, and next week

**Parameters**:
- `task_identifier` (string): Text to match against existing tasks (see Task Identification Strategy)
- `destination` (enum): "backlog", "current_week", "next_week"

**Behavior**:
- Remove task from current location
- Add to destination with appropriate formatting
- If moving to backlog, add current date
- If moving from backlog, remove date

### 4. `finish_task`
**Purpose**: Mark a task as completed or closed

**Parameters**:
- `task_identifier` (string): Text to match against existing tasks (see Task Identification Strategy)
- `status` (enum): "completed" (x) or "closed" (-)

**Behavior**:
- Update task checkbox to `[x]` or `[-]`
- Preserve task text and description

### 5. `get_current_tasks`
**Purpose**: Retrieve the entire current.md file

**Parameters**: None

**Returns**: Full content of current.md file

### 6. `get_backlog`
**Purpose**: Retrieve the entire backlog.md file

**Parameters**: None

**Returns**: Full content of backlog.md file

### 7. `start_week`
**Purpose**: Execute the weekly transition workflow

**Parameters**: None

**Behavior**:
1. Create git commit with message "Pre-start-week backup"
2. Move "Last Week" section to archive.md with week date
3. Move finished tasks from "This Week" to "Last Week" section
4. Keep unfinished tasks in "This Week" 
5. Move all tasks from "Next Week" to "This Week"
6. Clear "Next Week" section
7. Create git commit with message "Completed week transition to [current date]"

## Task Identification Strategy

For commands that require a `task_identifier` parameter (`edit_task`, `move_task`, `finish_task`), the system uses case-insensitive substring matching with robust error handling.

### Matching Behavior
- **Case-insensitive substring match**: "review mcp" matches "Review MCP documentation"
- **Partial text matching**: "mcp" can match any task containing "mcp" 
- **Whitespace flexible**: Extra spaces ignored in matching

### Error Handling
- **Multiple matches**: If identifier matches multiple tasks, return error with list of all matching tasks
- **No matches**: If identifier matches no tasks, return error with suggestions of similar tasks
- **Empty identifier**: Return error requesting valid task text

### Examples
```
✓ Good: "review mcp" → matches "Review MCP documentation" 
✗ Ambiguous: "task" → matches "Add task feature" AND "Review task management"
  → Error: "Multiple matches found: [list both tasks]"
✗ Not found: "xyz" → Error: "No matching tasks. Did you mean: [closest matches]?"
```

## Technical Requirements

### Version Control Integration
- Initialize git repository if not present
- Automatically commit after every operation with descriptive messages
- Use operation-specific commit messages (e.g., "Added task: Review documentation", "Completed task: Setup environment", "Weekly transition to 2024-03-15")
- Additional pre/post commits for `start_week` operations for extra safety

### Error Handling
- Validate file existence before operations
- Handle file permission issues gracefully
- Provide clear error messages for invalid task identifiers
- Atomic operations where possible (especially for `start_week`)

### File Management
- Create missing files with appropriate headers
- Maintain consistent markdown formatting
- Preserve existing formatting and whitespace where possible

## Design Principles

### Simplicity
- Keep files small enough for full agent reasoning
- Avoid complex search or statistics functionality
- Prefer multiple tool calls over bulk operations for transparency

### Reliability
- Use git for backup and recovery rather than custom rollback logic
- Validate operations before execution
- Provide clear feedback on operation success/failure

### Flexibility
- Support task descriptions for additional context
- Allow partial text matching for task identification
- Maintain human-readable markdown format

## Future Considerations

- System designed to keep files small and manageable
- Agent reasoning preferred over complex query systems
- Additional tools can be added as needed without breaking core functionality
- Git history provides audit trail and recovery mechanism