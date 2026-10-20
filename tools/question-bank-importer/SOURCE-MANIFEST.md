# Level-isolated question-bank source manifest

Every level-specific preflight requires an owner-approved manifest whose SHA-256 is supplied separately to the command. The manifest declares one question DOCX, one answer DOCX, and one level-isolated media ZIP for each permitted level. Source paths are relative to `--source-dir`; each source file has its own SHA-256. The importer verifies the pinned manifest first, selects only the requested level's three paths, opens and hashes those paths, and stages their exact bytes for parsing. Other-level paths are never resolved or opened. A source run with no `--level` or explicit `--all` now fails before source reads; `--all` remains a separate whole-corpus operation and is not used for T056.

The machine-readable shape is [`source-manifest.schema.json`](source-manifest.schema.json). Example structure (hashes and paths here are placeholders):

```json
{
  "schemaVersion": 1,
  "files": [
    {
      "role": "questions",
      "level": 1,
      "path": "level-1/questions.docx",
      "sha256": "<64 hex characters>"
    },
    {
      "role": "answers",
      "level": 1,
      "path": "level-1/answers.docx",
      "sha256": "<64 hex characters>"
    },
    {
      "role": "media",
      "level": 1,
      "path": "level-1/media.zip",
      "sha256": "<64 hex characters>"
    }
  ]
}
```

The separate digest is a frozen approval input, not a value taken from the manifest itself:

```sh
pnpm qb:source:apply -- --level 1 \
  --source-dir /path/to/owner-approved-package \
  --source-manifest /path/to/owner-approved-package/manifest.json \
  --source-manifest-sha256 OWNER_APPROVED_SHA256
```

The existing shared `题库【三改】.docx` cannot be used for a level-specific request because it contains the full corpus. A Level 1 manifest must point to a Level 1-isolated question document; the importer will not inspect a mixed DOCX to derive one.
