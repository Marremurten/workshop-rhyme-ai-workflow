# Plan Verifier Memory

## Common Issues Found

### File Count Discrepancies
- Task descriptions often mention creating files (e.g., config files, CSS files) that are NOT listed in the explicit Files field. Always cross-check the description text against the file list. Task 5-impl in kanban-board was a concrete example: listed 5 files but description mentioned 2 additional (postcss.config.js, src/index.css).

### Test File Grouping
- Plans sometimes test multiple components in a single test file without making this explicit. Check that every component in the project structure either has a corresponding test file assigned to a task, or is explicitly noted as tested within another file.

### Orphaned Files in Project Structure
- Project structure sections may list files (like test setup files) that no task is responsible for creating. Cross-reference every file in the project structure against task file lists.

## Verification Approach
1. Extract ALL success criteria from PRD first (they are usually at the end of each "In Scope" subsection)
2. Extract ALL out-of-scope items as a checklist
3. Count files per task by reading the Files field AND scanning the description for additional file mentions
4. Verify TDD by checking both the task type labels and the Dependencies fields
5. Check dependency chains end-to-end, not just immediate pairs
