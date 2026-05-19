# CAST Implementation Guide

This document provides implementation guidance and validation examples for the CAST (Conventional Commit Abstract Syntax Tree) specification.

## Round-trip Conversion Examples

### Example 1: Simple Feature Commit

**Input:**
```
feat: add user authentication
```

**CAST:**
```js
{
  type: 'root',
  breaking: false,
  children: [
    {
      type: 'header',
      children: [
        {type: 'type', value: 'feat'},
        {type: 'description', children: [
          {type: 'text', value: ' add user authentication'}
        ]}
      ]
    }
  ]
}
```

**Round-trip Output:**
```
feat: add user authentication
```

✅ **Validation:** Perfect match - no information loss.

### Example 2: Breaking Change with Scope

**Input:**
```
feat(api)!: send email when product shipped
```

**CAST:**
```js
{
  type: 'root',
  breaking: true,
  children: [
    {
      type: 'header',
      children: [
        {type: 'type', value: 'feat'},
        {type: 'scope', value: 'api'},
        {type: 'breaking'},
        {type: 'description', children: [
          {type: 'text', value: ' send email when product shipped'}
        ]}
      ]
    }
  ]
}
```

**Round-trip Output:**
```
feat(api)!: send email when product shipped
```

✅ **Validation:** Perfect match - breaking indicator and scope preserved.

### Example 3: Complex Multi-section Commit

**Input:**
```
fix: prevent racing of requests

Introduce a request id and a reference to latest request. Dismiss
incoming responses other than from latest request.

Remove timeouts which were used to mitigate the racing issue but are
obsolete now.

Reviewed-by: Z
Refs: #123
```

**CAST:**
```js
{
  type: 'root',
  breaking: false,
  children: [
    {
      type: 'header',
      children: [
        {type: 'type', value: 'fix'},
        {type: 'description', children: [
          {type: 'text', value: ' prevent racing of requests'}
        ]}
      ]
    },
    {
      type: 'body',
      children: [
        {
          type: 'text', 
          value: 'Introduce a request id and a reference to latest request. Dismiss\nincoming responses other than from latest request.\n\nRemove timeouts which were used to mitigate the racing issue but are\nobsolete now.'
        }
      ]
    },
    {
      type: 'footer',
      children: [
        {
          type: 'trailer',
          children: [
            {type: 'trailerToken', value: 'Reviewed-by'},
            {type: 'trailerValue', children: [
              {type: 'text', value: ' Z'}
            ]}
          ]
        },
        {
          type: 'trailer',
          children: [
            {type: 'trailerToken', value: 'Refs'},
            {type: 'trailerValue', children: [
              {type: 'issueReference', value: '#123', prefix: '#', id: 123}
            ]}
          ]
        }
      ]
    }
  ]
}
```

**Round-trip Output:**
```
fix: prevent racing of requests

Introduce a request id and a reference to latest request. Dismiss
incoming responses other than from latest request.

Remove timeouts which were used to mitigate the racing issue but are
obsolete now.

Reviewed-by: Z
Refs: #123
```

✅ **Validation:** Perfect match - whitespace, line breaks, and structure preserved.

### Example 4: BREAKING CHANGE Footer with Issues

**Input:**
```
feat(foo)!: this is a breaking change

This commit breaks several things.
This is still considered the body of the message.

BREAKING CHANGE: I broke thing A
BREAKING CHANGE: I broke thing B
See: #100
Resolves: GH-101
```

**CAST:**
```js
{
  type: 'root',
  breaking: true,
  children: [
    {
      type: 'header',
      children: [
        {type: 'type', value: 'feat'},
        {type: 'scope', value: 'foo'},
        {type: 'breaking'},
        {type: 'description', children: [
          {type: 'text', value: ' this is a breaking change'}
        ]}
      ]
    },
    {
      type: 'body',
      children: [
        {
          type: 'text',
          value: 'This commit breaks several things.\nThis is still considered the body of the message.'
        }
      ]
    },
    {
      type: 'footer',
      children: [
        {
          type: 'trailer',
          children: [
            {type: 'trailerToken', value: 'BREAKING CHANGE'},
            {type: 'trailerValue', children: [
              {type: 'text', value: ' I broke thing A'}
            ]}
          ]
        },
        {
          type: 'trailer',
          children: [
            {type: 'trailerToken', value: 'BREAKING CHANGE'},
            {type: 'trailerValue', children: [
              {type: 'text', value: ' I broke thing B'}
            ]}
          ]
        },
        {
          type: 'trailer',
          children: [
            {type: 'trailerToken', value: 'See'},
            {type: 'trailerValue', children: [
              {type: 'issueReference', value: '#100', prefix: '#', id: 100}
            ]}
          ]
        },
        {
          type: 'trailer',
          children: [
            {type: 'trailerToken', value: 'Resolves'},
            {type: 'trailerValue', children: [
              {type: 'issueReference', value: 'GH-101', prefix: 'GH-', id: 101}
            ]}
          ]
        }
      ]
    }
  ]
}
```

**Round-trip Output:**
```
feat(foo)!: this is a breaking change

This commit breaks several things.
This is still considered the body of the message.

BREAKING CHANGE: I broke thing A
BREAKING CHANGE: I broke thing B
See: #100
Resolves: GH-101
```

✅ **Validation:** Perfect match - multiple trailers and issue references preserved.

### Example 5: Complete Position Information

**Input:**
```
feat(api): add user auth

This adds authentication.

Resolves: #123
```

**CAST with Position Information:**
```js
{
  type: 'root',
  breaking: false,
  position: {
    start: {line: 1, column: 1, offset: 0},
    end: {line: 5, column: 14, offset: 66}
  },
  children: [
    {
      type: 'header',
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 23, offset: 22}
      },
      children: [
        {
          type: 'type',
          value: 'feat',
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 5, offset: 4}
          }
        },
        {
          type: 'scope',
          value: 'api',
          position: {
            start: {line: 1, column: 5, offset: 4},
            end: {line: 1, column: 10, offset: 9}
          }
        },
        {
          type: 'description',
          position: {
            start: {line: 1, column: 10, offset: 9},
            end: {line: 1, column: 23, offset: 22}
          },
          children: [
            {
              type: 'text',
              value: ' add user auth',
              position: {
                start: {line: 1, column: 11, offset: 10},
                end: {line: 1, column: 23, offset: 22}
              }
            }
          ]
        }
      ]
    },
    {
      type: 'body',
      position: {
        start: {line: 3, column: 1, offset: 25},
        end: {line: 3, column: 25, offset: 49}
      },
      children: [
        {
          type: 'text',
          value: 'This adds authentication.',
          position: {
            start: {line: 3, column: 1, offset: 25},
            end: {line: 3, column: 25, offset: 49}
          }
        }
      ]
    },
    {
      type: 'footer',
      position: {
        start: {line: 5, column: 1, offset: 52},
        end: {line: 5, column: 14, offset: 66}
      },
      children: [
        {
          type: 'trailer',
          position: {
            start: {line: 5, column: 1, offset: 52},
            end: {line: 5, column: 14, offset: 66}
          },
          children: [
            {
              type: 'trailerToken',
              value: 'Resolves',
              position: {
                start: {line: 5, column: 1, offset: 52},
                end: {line: 5, column: 9, offset: 60}
              }
            },
            {
              type: 'trailerValue',
              position: {
                start: {line: 5, column: 9, offset: 60},
                end: {line: 5, column: 14, offset: 66}
              },
              children: [
                {
                  type: 'issueReference',
                  value: '#123',
                  prefix: '#',
                  id: 123,
                  position: {
                    start: {line: 5, column: 11, offset: 62},
                    end: {line: 5, column: 14, offset: 66}
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

✅ **Validation:** Demonstrates complete position tracking for every node in the tree.

## Implementation Considerations

### 1. Whitespace Preservation

**Critical:** Leading and trailing whitespace in text nodes must be preserved exactly as it appears in the source.

- Description text includes the leading space after the colon
- Trailer values include the leading space after the colon
- Body text preserves all internal whitespace and line breaks

### 2. Issue Reference Detection

Issue references should be detected within trailer values and represented as separate `IssueReference` nodes:

**Supported formats:**
- `#123` (GitHub style)
- `GH-123` (GitHub explicit)
- `gh-123` (GitHub lowercase)

**Mixed content example:**
```js
// Input: "Fixes: #100, #200, and GH-300"
{
  type: 'trailerValue',
  children: [
    {type: 'issueReference', value: '#100', prefix: '#', id: 100},
    {type: 'text', value: ', '},
    {type: 'issueReference', value: '#200', prefix: '#', id: 200},
    {type: 'text', value: ', and '},
    {type: 'issueReference', value: 'GH-300', prefix: 'GH-', id: 300}
  ]
}
```

### 3. Section Separation

The parser must correctly identify section boundaries:

1. **Header**: First line only
2. **Body**: Everything between first blank line and start of footer
3. **Footer**: Git trailers at the end, separated by blank line

### 4. Trailer Format

Trailers must follow git trailer format: `<token>: <value>`

**Valid tokens:**
- Must start with a letter
- Can contain letters, numbers, and hyphens
- Case-sensitive
- Examples: `BREAKING CHANGE`, `Reviewed-by`, `Co-authored-by`, `Refs`, `Fixes`

### 5. Optional Nodes

Some nodes may not be present:

- `Scope`: Only if scope is specified in parentheses
- `Breaking`: Only if `!` is present in header
- `Body`: Only if body content exists
- `Footer`: Only if trailers exist

### 6. Breaking Change Detection

The root `breaking` field provides a consistent way to detect breaking changes regardless of how they are indicated:

```js
function detectBreakingChanges(tree) {
  // Check for breaking change indicator in header
  const header = tree.children.find(child => child.type === 'header')
  const hasHeaderBreaking = header?.children.some(child => child.type === 'breaking')

  // Check for BREAKING CHANGE trailer in footer
  const footer = tree.children.find(child => child.type === 'footer')
  const hasFooterBreaking = footer?.children.some(trailer =>
    trailer.type === 'trailer' &&
    trailer.children.some(child =>
      child.type === 'trailerToken' &&
      child.value === 'BREAKING CHANGE'
    )
  )

  return hasHeaderBreaking || hasFooterBreaking
}

// Set the breaking field on the root
tree.breaking = detectBreakingChanges(tree)
```

**Breaking Change Examples:**

1. **Header indicator**: `feat!: add new API` → `breaking: true`
2. **Header with scope**: `feat(api)!: breaking change` → `breaking: true`
3. **Footer trailer**: `BREAKING CHANGE: API changed` → `breaking: true`
4. **Both present**: Both header `!` and footer `BREAKING CHANGE:` → `breaking: true`
5. **Neither present**: Regular commit → `breaking: false`

### 6. Positional Information

When parsing with position tracking, every node should include precise source location information:

```js
{
  type: 'text',
  value: 'add user authentication',
  position: {
    start: {line: 1, column: 6, offset: 5},
    end: {line: 1, column: 27, offset: 26}
  }
}
```

#### Position Mapping from Tokens

The parser receives detailed position information from the lexer for each token:

```js
// Lexer token example:
{
  tokenType: 'TYPE',
  image: 'feat',
  startLine: 1,
  startColumn: 1,
  endColumn: 4,
  startOffset: 0,
  endOffset: 3
}

// Corresponding CAST node:
{
  type: 'type',
  value: 'feat',
  position: {
    start: {line: 1, column: 1, offset: 0},
    end: {line: 1, column: 5, offset: 4}  // end is exclusive
  }
}
```

#### Composite Node Positions

For nodes that span multiple tokens, calculate positions from children:

```js
// Header spanning multiple tokens: feat(api): add auth
{
  type: 'header',
  position: {
    start: {line: 1, column: 1, offset: 0},      // from first child (type)
    end: {line: 1, column: 25, offset: 24}       // from last child (description)
  },
  children: [
    {
      type: 'type',
      value: 'feat',
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 5, offset: 4}
      }
    },
    {
      type: 'scope',
      value: 'api',
      position: {
        start: {line: 1, column: 6, offset: 5},  // includes opening paren
        end: {line: 1, column: 10, offset: 9}    // includes closing paren
      }
    },
    {
      type: 'description',
      position: {
        start: {line: 1, column: 11, offset: 10}, // includes colon and space
        end: {line: 1, column: 25, offset: 24}
      },
      children: [
        {
          type: 'text',
          value: ' add auth',
          position: {
            start: {line: 1, column: 11, offset: 10},
            end: {line: 1, column: 25, offset: 24}
          }
        }
      ]
    }
  ]
}
```

#### Issue Reference Positions

Issue references within trailer values require substring position calculation:

```js
// Input: "Resolves: #123 and fixes #456"
{
  type: 'trailerValue',
  position: {
    start: {line: 5, column: 11, offset: 62},
    end: {line: 5, column: 31, offset: 82}
  },
  children: [
    {
      type: 'issueReference',
      value: '#123',
      prefix: '#',
      id: 123,
      position: {
        start: {line: 5, column: 11, offset: 62},
        end: {line: 5, column: 15, offset: 66}
      }
    },
    {
      type: 'text',
      value: ' and fixes ',
      position: {
        start: {line: 5, column: 15, offset: 66},
        end: {line: 5, column: 26, offset: 77}
      }
    },
    {
      type: 'issueReference',
      value: '#456',
      prefix: '#',
      id: 456,
      position: {
        start: {line: 5, column: 26, offset: 77},
        end: {line: 5, column: 30, offset: 81}
      }
    }
  ]
}
```

#### Multi-line Position Handling

For nodes spanning multiple lines (like body text):

```js
// Input body:
// "This adds authentication.\nIt includes login and logout."
{
  type: 'body',
  position: {
    start: {line: 3, column: 1, offset: 26},
    end: {line: 4, column: 30, offset: 81}
  },
  children: [
    {
      type: 'text',
      value: 'This adds authentication.\nIt includes login and logout.',
      position: {
        start: {line: 3, column: 1, offset: 26},
        end: {line: 4, column: 30, offset: 81}
      }
    }
  ]
}
```

## Serialization Algorithm

To convert CAST back to commit message text:

1. **Serialize Header:**
   - Concatenate: `type` + `(scope)` + `!` + `:` + `description`
   - Include optional elements only if present

2. **Serialize Body:**
   - Add blank line after header if body exists
   - Concatenate all text content preserving line breaks

3. **Serialize Footer:**
   - Add blank line after body if footer exists
   - For each trailer: `token` + `:` + `value`
   - Preserve order of trailers

## Validation Rules

### Required Structure

- Root must contain at least a Header
- Header must contain at least Type and Description
- Trailers must have both token and value

### Content Constraints

- Type value must be non-empty string
- Scope value (if present) must be non-empty string
- Description must contain at least one text node with non-empty value
- Trailer tokens must match git trailer format

### Node Ordering

- Header must be first child of Root
- Body (if present) must come after Header
- Footer (if present) must come after Body
- Within Header: Type, Scope (optional), Breaking (optional), Description
- Within Trailer: TrailerToken, TrailerValue

## Error Handling

Common parsing errors and AST representation:

1. **Invalid header format:** Missing type or description
2. **Malformed trailers:** Missing colon or invalid token format  
3. **Mixed content:** Body content mixed with trailers

These should be handled gracefully with appropriate error messages that reference position information when available.

## Ecosystem Integration

### Unified Processor Plugin

```js
import {unified} from 'unified'
import {castFromString} from 'cast-util-from-string'
import {castToString} from 'cast-util-to-string'

const processor = unified()
  .use(castFromString)
  .use(someTransformPlugin)
  .use(castToString)

const result = await processor.process(commitMessage)
```

### Transformation Example

```js
// Add issue reference to all commit messages
function addIssueReference(tree) {
  // Find or create footer
  let footer = tree.children.find(child => child.type === 'footer')
  if (!footer) {
    footer = {type: 'footer', children: []}
    tree.children.push(footer)
  }
  
  // Add trailer
  footer.children.push({
    type: 'trailer',
    children: [
      {type: 'trailerToken', value: 'Relates-to'},
      {type: 'trailerValue', children: [
        {type: 'issueReference', value: '#JIRA-123', prefix: '#', id: 'JIRA-123'}
      ]}
    ]
  })
}
```

This implementation guide ensures that CAST provides a robust foundation for programmatic manipulation of conventional commit messages while maintaining perfect fidelity to the original text through round-trip conversion.
