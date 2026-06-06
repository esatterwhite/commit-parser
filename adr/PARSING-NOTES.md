# Conventional Commit Parser: Learnings and Decisions

## Overview

This document captures the key learnings, findings, and architectural decisions made during the development of a conventional commit message parser using the Chevrotain parser library.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Key Challenges and Solutions](#key-challenges-and-solutions)
3. [Lexer Mode Design](#lexer-mode-design)
4. [Footer Parsing Evolution](#footer-parsing-evolution)
5. [Issue Reference Extraction](#issue-reference-extraction)
6. [Design Patterns and Best Practices](#design-patterns-and-best-practices)
7. [Testing Insights](#testing-insights)
8. [Future Considerations](#future-considerations)

---

## Architecture Overview

### Component Structure

The parser is organized into four main components:

```
lib/
├── tokens.js    - Token definitions with lexer modes
├── lexer.js     - Multi-mode lexer configuration
├── parser.js    - Grammar rules (CST parser)
└── visitor.js   - CST to JSON transformation
```

### Why Chevrotain?

**Decision**: Use Chevrotain instead of traditional parser generators (PEG.js, ANTLR, etc.)

**Rationale**:
- Pure JavaScript implementation (no code generation step)
- Excellent error recovery and reporting
- Built-in CST (Concrete Syntax Tree) support
- Multi-mode lexer support for context-sensitive tokenization
- Performance optimizations built-in
- Active maintenance and TypeScript support

---

## Key Challenges and Solutions

### Challenge 1: Context-Sensitive Tokenization

**Problem**: Different parts of a commit message require different tokenization rules.

Example:
```
feat(scope): description
             ^^^^^^^^^^ - Everything after colon is description text
```

In the header, `:` is a separator token, but in the description, it should be part of the text.

**Solution**: Multi-mode lexer with 5 distinct modes:

1. `header_mode` (default) - Parse type, scope, breaking indicator
2. `scope_mode` - Inside parentheses, parse scope text
3. `description_mode` - After colon, parse description text
4. `body_or_footer_mode` - After blank line, detect body text or footers
5. `footer_separator_mode` - After footer token, expect colon separator
6. `footer_value_mode` - Parse footer values

**Key Learning**: Mode transitions via `push_mode`, `pop_mode` allow context-sensitive parsing without complex lookahead logic.

---

### Challenge 2: Hash Symbol Ambiguity

**Problem**: Hash symbols (`#`) appear in multiple contexts with different meanings:

```
feat: add feature

# This is a markdown heading in the body
Some text with #hashtags

Resolves: #100
```

**Initial Approach** (FAILED):
- Treated `#` as a footer separator token (like `Refs #123`)
- Added FOOTER_HASH to `body_or_footer_mode`
- **Result**: Hash symbols at the start of body lines were incorrectly parsed as footer separators

**Solution Evolution**:

1. **First Fix**: Removed FOOTER_HASH from `body_or_footer_mode`
   - **Problem**: Broke `Refs #123` style footers

2. **Second Fix**: Added `footer_separator_mode`
   - FOOTER_TOKEN pushes to this mode
   - FOOTER_HASH only available in `footer_separator_mode`
   - **Problem**: Doesn't follow git trailer format standard

3. **Final Solution**: Remove hash as separator entirely
   - All footers use colon separator: `Key: value`
   - Hash symbols in footer values are part of the value
   - Issue references extracted from footer values during visitor phase
   - **Result**: Clean separation of concerns, follows git standards

**Key Learning**: Lexer modes should be used to restrict token availability to specific contexts, preventing ambiguous matches.

---

### Challenge 3: Git Trailer Format

**Problem**: Initial implementation didn't follow standard git trailer format.

**Git Trailer Format Standard**:
```
Token: value
Token-Name: value with spaces
BREAKING CHANGE: description
```

**Key Requirements**:
- Trailer keys: `[A-Za-z]+([-][A-Za-z]+)*`
- Separator: Always colon (`:`)
- Values: Can contain any text, including issue references

**Implementation**:

```javascript
// Token pattern with lookahead for colon
const FOOTER_TOKEN = createToken({
  name: 'FOOTER_TOKEN'
, pattern: /[A-Za-z]+([-][A-Za-z]+)*(?=[ \t]*:)/
, push_mode: 'footer_separator_mode'
})
```

**Key Learning**: Use positive lookahead `(?=...)` to match tokens that must be followed by specific patterns without consuming those patterns.

---

## Lexer Mode Design

### Mode Transition Flow

```
header_mode (default)
    ↓ (COLON)
description_mode
    ↓ (BLANK_LINE)
body_or_footer_mode
    ↓ (FOOTER_TOKEN or BREAKING_CHANGE)
footer_separator_mode
    ↓ (FOOTER_COLON)
footer_value_mode
    ↓ (NEW_LINE + FOOTER_TOKEN) → back to footer_separator_mode
    ↓ (NEW_LINE + BODY_TEXT) → stays in footer_value_mode
```

### Mode Design Principles

1. **Explicit Transitions**: Each mode transition should be explicit and predictable
2. **Minimal Token Sets**: Each mode should contain only the tokens valid in that context
3. **Clear Exit Conditions**: Every mode should have clear conditions for transitioning out
4. **Symmetric Patterns**: Use `push_mode`/`pop_mode` pairs for nested structures (like parentheses)

### Example: Scope Parsing

```javascript
// In header_mode
const LPAREN = createToken({
  pattern: /\(/
, push_mode: 'scope_mode'  // Enter scope context
})

// In scope_mode
const RPAREN = createToken({
  pattern: /\)/
, pop_mode: true  // Exit scope context
})
```

**Key Learning**: The `push_mode`/`pop_mode` pattern mirrors the nested structure of the syntax, making the lexer intuitive and maintainable.

---

## Footer Parsing Evolution

### Version 1: Simple Array of Footers

**Structure**:
```javascript
{
  footers: [
    {token: 'Refs', separator: '#', value: '123'},
    {token: 'Signed-Off-By', separator: ':', value: 'me'}
  ]
}
```

**Problems**:
- Mixed separator types (`:` and `#`) violated git trailer format
- No structured access to trailer values
- Issue references not extracted

---

### Version 2: Git Trailer Format with Issue Extraction

**Structure**:
```javascript
{
  footer: "Is-Valid: true\nSigned-Off-By: me\nResolves: #100",
  trailers: {
    "Is-Valid": "true",
    "Signed-Off-By": "me",
    "Resolves": "#100"
  },
  issues: [
    {issue: '#100', prefix: '#', id: 100}
  ]
}
```

**Benefits**:
- `footer`: Preserves original text for display/formatting
- `trailers`: Structured key-value access
- `issues`: Extracted and parsed issue references
- Follows git trailer format standard

**Key Learning**: Provide multiple views of the same data for different use cases (raw text, structured access, extracted metadata).

---

## Issue Reference Extraction

### Supported Formats

```javascript
#123           // GitHub-style short reference
GH-456         // GitHub prefix
gh-789         // Lowercase variant
```

### Implementation

```javascript
extractIssues(text) {
  const issues = []
  const issue_pattern = /(#|GH-|gh-)(\d+)/g
  let match

  while ((match = issue_pattern.exec(text)) !== null) {
    issues.push({
      issue: match[0]      // Full match: "#100"
    , prefix: match[1]     // Prefix: "#"
    , id: parseInt(match[2], 10)  // Numeric ID: 100
    })
  }

  return issues
}
```

### Design Decisions

**Why extract during visitor phase, not lexing?**

1. **Separation of Concerns**: Lexer handles tokenization, visitor handles semantic extraction
2. **Flexibility**: Easy to add new issue reference formats without changing lexer
3. **Performance**: Regex matching only on footer values, not entire input
4. **Clarity**: Issue references are semantic information, not syntactic tokens

**Key Learning**: Not everything needs to be a token. Post-processing semantic information in the visitor phase can be simpler and more maintainable.

---

## Design Patterns and Best Practices

### 1. Token Ordering Matters

Chevrotain processes tokens in the order they're defined in the array. More specific tokens should come before general ones.

```javascript
const all_tokens = [
  BREAKING_CHANGE,  // More specific
  FOOTER_TOKEN,           // More general
  // ...
]
```

**Why**: `BREAKING_CHANGE` would match the pattern for `FOOTER_TOKEN`, so it needs to be checked first. We also mark it with `longer_alt: FOOTER_TOKEN` to help Chevrotain optimize.

---

### 2. Comma-First Style

**Project Convention**:
```javascript
const result = {
  type: null
, scope: null
, breaking: false
}
```

**Benefits**:
- Visual alignment of property names
- Easier to spot missing commas
- Consistent with project style guide

---

### 3. Avoid V8 Deoptimization

**Pattern**:
```javascript
module.exports = Object.assign(ConventionalCommitLexer, {
  multi_mode_lexer_definition
})
```

**Why**: Exporting a single object with additional properties avoids V8 deoptimization that can occur with multiple named exports in CommonJS.

---

### 4. Visitor Pattern for CST Transformation

**Pattern**:
```javascript
class ConventionalCommitVisitor extends BaseCstVisitor {
  commit(ctx) {
    // Transform CST node to JSON
    return this.visit(ctx.header)
  }

  header(ctx) {
    // Recursively visit child nodes
  }
}
```

**Benefits**:
- Clean separation between parsing and transformation
- Easy to modify output format without changing grammar
- Testable in isolation

---

## Testing Insights

### Edge Cases Discovered

1. **Hash at start of body line**:
   ```
   feat: add feature

   #100 is the issue number
   ```
   Initially parsed as footer, fixed with mode restrictions.

2. **Multiple hash symbols in body**:
   ```
   # Heading 1
   ## Heading 2
   ### Heading 3
   ```
   All correctly parsed as body text after mode fix.

3. **Multiple issues in one trailer**:
   ```
   Fixes: #100, #200, and #300
   ```
   All issues correctly extracted (3 issue objects).

4. **BREAKING CHANGE without push_mode**:
   ```
   BREAKING CHANGE: description
   ```
   Initially failed because BREAKING_CHANGE didn't push to footer_separator_mode.

### Testing Strategy

**Recommended Approach**:
1. Start with simple cases (header only)
2. Add complexity incrementally (scope, description, body)
3. Test edge cases (empty values, special characters)
4. Test mode transitions (blank lines, footers)
5. Test error cases (malformed input)

**Key Learning**: Mode-based parsing requires testing each mode transition explicitly.

---

## Future Considerations

### Potential Enhancements

1. **Multi-line Footer Values**:
   ```
   Description: This is a very long
     description that spans multiple
     lines with indentation.
   ```
   Current implementation supports this, but needs testing.

2. **Additional Issue Reference Formats**:
   - Jira: `PROJ-123`
   - GitLab: `!456` (merge requests)
   - Full URLs: `https://github.com/org/repo/issues/123`

3. **Validation Mode**:
   - Strict vs. permissive parsing
   - Validate trailer keys against whitelist
   - Enforce breaking change presence for `!` indicator

4. **Performance Optimization**:
   - Benchmark with large commit messages
   - Consider caching lexer/parser instances
   - Profile visitor transformations

5. **Error Recovery**:
   - Currently fails on invalid input
   - Could provide partial results with error annotations
   - Suggest corrections for common mistakes

---

## Conclusion

### Key Takeaways

1. **Multi-mode lexing is powerful** for context-sensitive languages
2. **Separate lexical and semantic concerns** (tokens vs. extracted data)
3. **Follow standards** (git trailer format) rather than inventing new conventions
4. **Test mode transitions explicitly** - they're the most error-prone areas
5. **Provide multiple views** of parsed data for different use cases

### Success Metrics

- ✅ Parses all valid conventional commit formats
- ✅ Handles hash symbols in body text correctly
- ✅ Follows git trailer format standard
- ✅ Extracts issue references automatically
- ✅ Provides structured output (footer, trailers, issues)
- ✅ All tests passing

---

## References

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Git Trailer Format](https://git-scm.com/docs/git-interpret-trailers)
- [Chevrotain Documentation](https://chevrotain.io/docs/)
- [Chevrotain Multi-Mode Lexer](https://chevrotain.io/docs/features/multiple_lexer_modes.html)

---

*Document created: 2026-05-16*
*Last updated: 2026-05-16*

