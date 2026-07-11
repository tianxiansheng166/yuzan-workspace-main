## [ERR-20260711-001] python-playwright-runtime

**Logged**: 2026-07-11T00:00:00+08:00
**Priority**: medium
**Status**: pending
**Area**: tests

### Summary
Bundled Python runtime does not expose the Playwright module required by the generic webapp-testing helper workflow.

### Error
```
ModuleNotFoundError: No module named 'playwright'
```

### Context
- Static runtime server started successfully on port 4173.
- Browser audit script failed at Python import time.
- Windows Codex bundled Python was used with its dependency directory on PYTHONPATH.

### Suggested Fix
Use the repository's existing Node Playwright dependency after frozen-lockfile installation, or provision Python Playwright in the bundled runtime.

### Metadata
- Reproducible: yes
- Related Files: apps/web/package.json

---
