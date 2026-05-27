# CAST Position Mapping Guide

This document provides detailed guidance on how to map position information from the Chevrotain CST (Concrete Syntax Tree) to CAST (Conventional Commit Abstract Syntax Tree) nodes.

## Overview

The Chevrotain lexer provides detailed position information for each token:

```js
{
  tokenType: 'TYPE',
  image: 'feat',
  startLine: 1,        // 1-indexed
  startColumn: 1,      // 1-indexed
  endColumn: 4,        // 1-indexed, inclusive
  startOffset: 0,      // 0-indexed
  endOffset: 3         // 0-indexed, inclusive
}
```

CAST nodes use unist-compliant position format:

```js
{
  position: {
    start: {line: 1, column: 1, offset: 0},    // 1-indexed line/column, 0-indexed offset
    end: {line: 1, column: 5, offset: 4}       // exclusive end positions
  }
}
```

## Token to Position Conversion

### Basic Conversion Formula

```js
function tokenToPosition(token) {
  return {
    start: {
      line: token.startLine,
      column: token.startColumn,
      offset: token.startOffset
    },
    end: {
      line: token.endLine || token.startLine,
      column: token.endColumn + 1,  // Convert from inclusive to exclusive
      offset: token.endOffset + 1   // Convert from inclusive to exclusive
    }
  }
}
```

### Examples

```js
// Input token: TYPE = 'feat' at line 1, col 1-4, offset 0-3
{
  position: {
    start: {line: 1, column: 1, offset: 0},
    end: {line: 1, column: 5, offset: 4}  // exclusive end
  }
}

// Input token: SCOPE_TEXT = 'api' at line 1, col 6-8, offset 5-7  
{
  position: {
    start: {line: 1, column: 6, offset: 5},
    end: {line: 1, column: 9, offset: 8}  // exclusive end
  }
}
```

## Node-Specific Position Mapping

### 1. Token-Based Nodes (Direct Mapping)

These nodes map directly from a single token:

#### Type Node
```js
// CST: TYPE token
// Input: 'feat' at line 1, col 1-4, offset 0-3
{
  type: 'type',
  value: 'feat',
  position: {
    start: {line: 1, column: 1, offset: 0},
    end: {line: 1, column: 5, offset: 4}
  }
}
```

#### Scope Node
```js
// CST: SCOPE_TEXT toke
// Input: 'api' at line 1, col 6-8, offset 5-7
// Note: Includes surrounding parentheses in position
{
  type: 'scope',
  value: 'api',
  position: {
    start: {line: 1, column: 5, offset: 4},  // Include opening paren
    end: {line: 1, column: 10, offset: 9}    // Include closing paren
  }
}
```

#### TrailerToken Node
```js
// CST: FOOTER_TOKEN token
// Input: 'Resolves' at line 5, col 1-8, offset 52-59
{
  type: 'trailerToken',
  value: 'Resolves',
  position: {
    start: {line: 5, column: 1, offset: 52},
    end: {line: 5, column: 9, offset: 60}
  }
}
```

### 2. Composite Nodes (Calculated from Children)

These nodes span multiple tokens and calculate position from their children:

#### Header Node
```js
// Spans from first child (type) to last child (description)
function calculateHeaderPosition(children) {
  const firstChild = children[0]
  const lastChild = children[children.length - 1]
  
  return {
    start: firstChild.position.start,
    end: lastChild.position.end
  }
}

// Example:
// feat(api): add user auth
{
  type: 'header',
  position: {
    start: {line: 1, column: 1, offset: 0},      // from 'feat'
    end: {line: 1, column: 23, offset: 22}       // from ' add user auth'
  },
  children: [/* type, scope, description */]
}
```

#### Description Node  
```js
// CST: DESCRIPTION_TEXT token
// Input: ' add user auth' at line 1, col 11-23, offset 10-22
// Note: Includes colon and leading space in position calculation
{
  type: 'description',
  position: {
    start: {line: 1, column: 10, offset: 9},   // Include colon
    end: {line: 1, column: 24, offset: 23}     // End of description text
  },
  children: [
    {
      type: 'text',
      value: ' add user auth',
      position: {
        start: {line: 1, column: 11, offset: 10},  // After colon
        end: {line: 1, column: 24, offset: 23}
      }
    }
  ]
}
```

#### Body Node
```js
// CST: Multiple BODY_TEXT tokens
// Handle multi-line content
{
  type: 'body',
  position: {
    start: {line: 3, column: 1, offset: 25},
    end: {line: 4, column: 30, offset: 81}
  },
  children: [
    {
      type: 'text',
      value: 'This adds authentication.\nIt includes login and logout.',
      position: {
        start: {line: 3, column: 1, offset: 25},
        end: {line: 4, column: 30, offset: 81}
      }
    }
  ]
}
```

#### Footer Node
```js
// Spans all trailer children
function calculateFooterPosition(children) {
  const firstChild = children[0]
  const lastChild = children[children.length - 1]
  
  return {
    start: firstChild.position.start,
    end: lastChild.position.end
  }
}
```

### 3. Special Cases

#### Breaking Node
```js
// CST: BANG token
// Input: '!' at line 1, col 9-9, offset 8-8
{
  type: 'breaking',
  position: {
    start: {line: 1, column: 9, offset: 8},
    end: {line: 1, column: 10, offset: 9}
  }
}
```

#### TrailerValue with Issue References
```js
// CST: FOOTER_VALUE_TEXT token = '#123 and #456'
// Input: '#123 and #456' at line 5, col 11-21, offset 62-72

// Parse issue references within the value
function parseTrailerValue(token) {
  const fullText = token.image
  const basePosition = tokenToPosition(token)
  const children = []
  
  // Use regex to find issue references
  const issuePattern = /(#|GH-|gh-)(\d+)/g
  let lastIndex = 0
  let match
  
  while ((match = issuePattern.exec(fullText)) !== null) {
    // Add text before issue reference
    if (match.index > lastIndex) {
      const textBefore = fullText.slice(lastIndex, match.index)
      children.push({
        type: 'text',
        value: textBefore,
        position: calculateSubstringPosition(basePosition, lastIndex, match.index)
      })
    }
    
    // Add issue reference
    children.push({
      type: 'issuereference',
      value: match[0],
      prefix: match[1],
      id: parseInt(match[2], 10),
      position: calculateSubstringPosition(basePosition, match.index, match.index + match[0].length)
    })
    
    lastIndex = match.index + match[0].length
  }
  
  // Add remaining text
  if (lastIndex < fullText.length) {
    const textAfter = fullText.slice(lastIndex)
    children.push({
      type: 'text',
      value: textAfter,
      position: calculateSubstringPosition(basePosition, lastIndex, fullText.length)
    })
  }
  
  return {
    type: 'trailerValue',
    position: basePosition,
    children: children
  }
}

function calculateSubstringPosition(basePosition, startIndex, endIndex) {
  return {
    start: {
      line: basePosition.start.line,
      column: basePosition.start.column + startIndex,
      offset: basePosition.start.offset + startIndex
    },
    end: {
      line: basePosition.start.line,
      column: basePosition.start.column + endIndex,
      offset: basePosition.start.offset + endIndex
    }
  }
}
```

## Implementation Algorithm

### Step 1: Collect Token Positions

```js
function visitCST(cstNode, tokenPositions = new Map()) {
  // Collect all token positions during CST traversal
  if (cstNode.children) {
    Object.values(cstNode.children).forEach(childArray => {
      childArray.forEach(child => {
        if (child.tokenType) {
          // This is a token
          tokenPositions.set(child, tokenToPosition(child))
        } else {
          // This is a rule, recurse
          visitCST(child, tokenPositions)
        }
      })
    })
  }
  return tokenPositions
}
```

### Step 2: Map CST to AST with Positions

```js
class PositionalVisitor extends ConventionalCommitVisitor {
  constructor() {
    super()
    this.tokenPositions = new Map()
  }
  
  visit(cstNode) {
    // Collect token positions first
    this.tokenPositions = visitCST(cstNode)
    
    // Then visit normally, adding positions
    return super.visit(cstNode)
  }
  
  type(ctx) {
    const token = ctx.TYPE[0]
    return {
      type: 'type',
      value: token.image,
      position: this.tokenPositions.get(token)
    }
  }
  
  scope(ctx) {
    const scopeToken = ctx.SCOPE_TEXT[0]
    const lparenToken = ctx.LPAREN?.[0]
    const rparenToken = ctx.RPAREN?.[0]
    
    // Calculate position spanning parentheses
    const start = lparenToken ? 
      this.tokenPositions.get(lparenToken).start :
      this.tokenPositions.get(scopeToken).start
      
    const end = rparenToken ?
      this.tokenPositions.get(rparenToken).end :
      this.tokenPositions.get(scopeToken).end
    
    return {
      type: 'scope',
      value: scopeToken.image,
      position: {start, end}
    }
  }
  
  // ... other visitor methods with position mapping
}
```

## Multi-line Handling

For tokens that span multiple lines (like body text):

```js
// CST token: BODY_TEXT = 'Line 1\nLine 2\nLine 3'
// startLine: 3, endLine: 5, startColumn: 1, endColumn: 6
// startOffset: 25, endOffset: 45

{
  type: 'text',
  value: 'Line 1\nLine 2\nLine 3',
  position: {
    start: {line: 3, column: 1, offset: 25},
    end: {line: 5, column: 7, offset: 46}  // exclusive end
  }
}
```

## Validation

### Position Consistency Checks

1. **Parent spans children**: Parent position should encompass all children
2. **No overlaps**: Sibling nodes should not overlap in position
3. **Monotonic offsets**: Positions should increase monotonically through the tree
4. **Line/column consistency**: Line and column should match offset calculations

```js
function validatePositions(node, source) {
  if (!node.position) return true
  
  // Check position matches source content
  const {start, end} = node.position
  const expectedText = source.slice(start.offset, end.offset)
  
  if (node.type === 'text') {
    assert.equal(node.value, expectedText)
  }
  
  // Validate children are within parent bounds
  if (node.children) {
    node.children.forEach(child => {
      if (child.position) {
        assert(child.position.start.offset >= start.offset)
        assert(child.position.end.offset <= end.offset)
      }
    })
  }
}
```

This position mapping system ensures that every CAST node can be precisely traced back to its location in the original commit message, enabling powerful tooling for error reporting, IDE integration, and source transformation.
