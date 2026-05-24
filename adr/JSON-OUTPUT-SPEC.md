# JSON Output Specification for Conventional Commit Parser

This document outlines the proposed JSON structure for actionable outputs from the conventional commit parser. This format is designed for backwards compatibility and ease of use in tools that need structured commit data without the complexity of working with the full CAST AST.

## Overview

The JSON output provides a flattened, easily consumable representation of conventional commit data, extracting key information from the CAST AST for common use cases like:

- Changelog generation
- Release automation
- Commit validation
- Issue tracking integration
- Breaking change detection

## JSON Structure

```typescript
interface ConventionalCommitJson {
  // Core commit information
  type: string | null                    // Commit type (feat, fix, etc.)
  scope: string | null                   // Optional scope
  breaking: boolean                      // Whether commit has breaking changes
  description: string | null             // Commit description

  // Extended content
  body: string | null                    // Commit body text
  footer: string | null                  // Full footer text

  // Structured trailer data
  trailers: Record<string, string>       // Key-value pairs of git trailers

  // Extracted metadata
  issues: IssueReference[]               // All issue references found
  breaking_changes?: string[]            // Breaking change descriptions (if any)
}

interface IssueReference {
  issue: string                          // Full issue text (e.g., "#123")
  prefix: string                         // Issue prefix (e.g., "#", "GH-")
  id: number                             // Issue number
}
```

## Example Output

### Simple Feature Commit

**Input:**
```
feat(api): add user authentication
```

**JSON Output:**
```json
{
  "type": "feat",
  "scope": "api", 
  "breaking": false,
  "description": "add user authentication",
  "body": null,
  "footer": null,
  "trailers": {},
  "issues": []
}
```

### Complex Commit with Breaking Changes

**Input:**
```
feat(api)!: add user authentication

This commit adds JWT-based authentication to the API.
It includes login, logout, and token refresh endpoints.

BREAKING CHANGE: authentication is now required for all API endpoints
Resolves: #123
Co-authored-by: Jane Doe <jane@example.com>
```

**JSON Output:**
```json
{
  "type": "feat",
  "scope": "api",
  "breaking": true,
  "description": "add user authentication",
  "body": "This commit adds JWT-based authentication to the API.\nIt includes login, logout, and token refresh endpoints.",
  "footer": "BREAKING CHANGE: authentication is now required for all API endpoints\nResolves: #123\nCo-authored-by: Jane Doe <jane@example.com>",
  "trailers": {
    "BREAKING CHANGE": "authentication is now required for all API endpoints",
    "Resolves": "#123",
    "Co-authored-by": "Jane Doe <jane@example.com>"
  },
  "issues": [
    {
      "issue": "#123",
      "prefix": "#", 
      "id": 123
    }
  ],
  "breaking_changes": [
    "authentication is now required for all API endpoints"
  ]
}
```

## Field Descriptions

### Core Fields

- **`type`**: The conventional commit type (feat, fix, docs, etc.). `null` if not found.
- **`scope`**: Optional scope indicating the area of change. `null` if not present.
- **`breaking`**: Boolean indicating if the commit introduces breaking changes (from `!` or `BREAKING CHANGE:` trailer).
- **`description`**: The short description of the change. `null` if not found.

### Content Fields

- **`body`**: The extended commit message body. `null` if not present. Preserves original formatting including newlines.
- **`footer`**: The full footer section as text. `null` if not present. Includes all trailers in their original format.

### Structured Data

- **`trailers`**: Object with trailer tokens as keys and their values as strings. Useful for programmatic access to metadata.
- **`issues`**: Array of all issue references found throughout the commit (description, body, trailers). Each reference includes the full text, prefix, and numeric ID.
- **`breaking_changes`**: Array of breaking change descriptions (only present if `breaking` is `true`). Contains the text from `BREAKING CHANGE:` trailers.

## Implementation Notes

### Text Extraction

All text content is extracted from the CAST AST by:
1. Traversing text and issuererence nodes
2. Concatenating their `value` fields
3. Preserving whitespace and formatting

### Issue Reference Detection

Issue references are detected using patterns like:
- `#123` (GitHub style)
- `GH-456` (GitHub prefix style)
- `gh-789` (lowercase variant)

### Breaking Change Detection

Breaking changes are identified by:
1. `!` indicator after type or scope in header
2. `BREAKING CHANGE:` or `BREAKING-CHANGE:` trailers in footer

### Trailer Processing

Git trailers are processed according to the [Git trailer format](https://git-scm.com/docs/git-interpret-trailers):
- Token and value separated by `:`
- Whitespace around separator is preserved in values
- Multi-line values are joined with newlines

## Backwards Compatibility

This JSON format maintains backwards compatibility with existing tools that expect:
- Simple string fields for common data
- Flat structure without nested objects (except for arrays)
- Consistent field naming conventions

## Future Considerations

Potential additions to the JSON format:
- **`position`**: Source location information for IDE integration
- **`metadata`**: Additional computed fields (word count, complexity scores, etc.)
- **`validation`**: Compliance with conventional commit rules
- **`related_commits`**: References to related commits mentioned in trailers

## Usage Examples

### Changelog Generation
```javascript
if (commit.type === 'feat') {
  changelog.features.push({
    scope: commit.scope,
    description: commit.description,
    breaking: commit.breaking,
    issues: commit.issues
  })
}
```

### Breaking Change Detection
```javascript
if (commit.breaking) {
  console.warn('Breaking change detected:', commit.breaking_changes)
}
```

### Issue Integration
```javascript
commit.issues.forEach(issue => {
  linkToIssue(issue.id, issue.prefix)
})
```
