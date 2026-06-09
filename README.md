# Conventional Commit Parser

A parser for conventional commit messages built with Chevrotain.

## Features

- Parse conventional commit messages according to the specification
- Generate AST (Abstract Syntax Tree) output
- Generate a JSON representation output
- Support for configurable breaking change phrases
- Railroad diagram generation for grammar visualization

## Usage

```javascript
const parser = require('conventional-commit-parser')

const result = parser.parse('feat(scope): add new feature')
console.log(result)
```

## Grammar Visualization

This parser includes railroad diagram generation to visualize the grammar rules:

```bash
# Generate railroad diagrams
npm run diagrams
```

The generated `conventional-commit-grammar-diagrams.html` file will show interactive railroad diagrams for all grammar rules, making it easy to understand the parser's structure and debug parsing issues.

## Scripts

- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run diagrams` - Generate railroad diagrams

## Development

The parser is built using:
- [Chevrotain](https://chevrotain.io/) - Parser building toolkit
- [unist](https://github.com/syntax-tree/unist) - universal syntax tree

See the `lib/` directory for implementation details:
- `lib/parser.js` - Main parser grammar
- `lib/tokens.js` - Token definitions
- `lib/visitor.js` - AST visitor
- `lib/chunker.js` - Pre-processing chunker


## Commit Abstract Syntax Tree (CAST)

All nodes extend the UNIST `Node` interface:

```idl
interface Node {
  type: string
  position?: Position?    // Mapping to original source offsets (0-indexed)
}

interface Position {
  start: Point
  end: Point              // Exclusive; first character after the node region
}

interface Point {
  line: number            // 1-indexed line
  column: number          // 1-indexed column
  offset: number          // 0-indexed absolute offset
}
```

## Top-Level CAST Structure

The root of every parse is a `{type: 'root'}` node. Its `children` array contains exactly one of each present section in the following order: Header, Body, and Footer.

```json5
Example Input: "feat(parser)!: add ASCII art\n\nThis is the body.\n\nFixes #42"

CAST Tree Root:
┌────────────── root ──────────────┐
│ breaking: true                   │  ← Computed from Header BANG or Footer BREAKING CHANGE
│ children: [                      │
│   header node,                   │  ← Always present (if input non-empty)
│   body node?,                    │  ← Present if body content exists
│   footer node?                   │  ← Present if trailers exist
│ ]                                │
└──────────────────────────────────┘
```

---

## 1. Header Section (`type: 'header'`)

The header serves as the entrance to the commit. It transforms from a structured CST into a simplified set of semantic nodes.

### Tree Shape
AConventional header contains a sequence of descriptive elements. Non-conventional headers (bare text) contain just a description.

```text
Conventional Header Children:
[ type ] → [ scope (opt) ] → [ bang (opt) ] → [ description ]
```

### Node Definitions

#### `type` & `scope`
Both are effectively wrappers for text content. The `type` represents the change category, and `scope` represents the affected area.

```idl
interface Type <: Node {
  type: 'type'
  value: string               // e.g., "feat"
}

interface Scope <: Node {
  type: 'scope'
  value: string               // text inside parens, e.g., "parser"
}
```

#### `bang`
A marker signifying a breaking change. In the CAST, it is a structural node that always carries a single child `{type: 'text', value: '!'}` to preserve original source content.

```idl
interface Bang <: Node {
  type: 'bang'
  children: [Text]            // contains exactly one text node with value "!"
}
```

#### `description`
The summary of the commit. It carries a boolean `breaking` flag and wraps the actual content in a child `text` node.

```idl
interface Description <: Node { 
  type: 'description'
  breaking: boolean           // true if preceded by a Bang node
  children: [Text]            // exactly one text child containing the summary
}
```

---

## 2. Body Section (`type: 'body'`)

The body is treated as an ordered list of lines. This preserves structure and paragraph breaks while ignoring internal parsing (the body is opaque).

### Tree Shape
The `body` node acts as a container for `line` nodes. Each line then contains its own text content.

```text
┌─────────── body ──────────────────┐
│ children: [                       │
│   { type: 'line',                 │ ← Content Line
│     children: [ {type:'text'} ] },│
│                                   │
│   { type: 'line',                 │ ← Blank Line
│     children: [] },               │
│                                   │
│   { type: 'line',                 │ ← Next Paragraph
│     children: [ {type:'text'} ] },│
│ ]                                 │
└───────────────────────────────────┘
```

### Node Definitions

```idl
interface Body <: Node { 
  type: 'body'
  children: [Line]           // One line node per physical line in body
}

interface Line <: Node { 
  type: 'line'
  children: [Text]           // Empty array for blank lines; single text child for content
}
```

---

## 3. Footer Section (`type: 'footer'`)

The footer is the most complex section, transforming a flat list of trailers into semantic key-value pairs that may contain mixed media (text + references).

### Tree Shape
A `footer` contains multiple `trailer` nodes. Each trailer is an atomic pair consisting of a key and its corresponding value.

```text
┌─────────── footer ──────────────┐
│ children: [                     │
│   trailer node,                 │ ← { type: 'trailer', children: [Key, Value] }
│   trailer node,                 │
│ ]                               │
└─────────────────────────────────┘
```

### Trailer Composition
A trailer decomposes into exactly two components: the **TrailerKey** (the label) and the **TrailerValue** (the content).

#### `trailer` & `trailerKey`
The trailer node summarizes the intent of the entry. If the key matches a "Reference Action" (e.g., "Fixes"), it is flagged for easy discovery.

```idl
interface Trailer <: Node {
  type: 'trailer'
  breaking: boolean           // true if key is "BREAKING CHANGE"
  action?: string             // e.g., "fixes", "closes" (if matched via config)
  children: [TrailerKey, TrailerValue]
}

interface TrailerKey <: Node { 
  type: 'trailerkey'
  children: [Text]            // a sequence of text nodes forming the key label
}
```

#### `trailerValue`
The value of a trailer is an ordered stream. Mixed content (text, mentions, and issue references) are stored as flat siblings in the `children` array.

```text
Example: "Fixes #42 and @alice"
Children: [ {type:'issuereference'}, {type:'text', value: ' and '}, {type:'mention'} ]
```

#### Reference Nodes (`issuereference` & `mention`)
Parsed references are extracted as semantic nodes rather than raw text.

```idl
interface IssueReference <: Node { 
  type: 'issuereference'
  value: string               // The full matched text (e.g., "GH-103")
  prefix: string              // The prefix found (e.g., "GH-")
  id: number | string         // Parsed ID
  repository?: string         // Populated for scoped refs ("skyring#1")
  owner?: string              // Populated for org refs ("org/repo#1")
}

interface Mention <: Node { 
  type: 'mention'
  username: string            // The handle without '@'
  value: string               // Full match (e.g., "@alice")
}
```

---

## Summary Example: End-to-End CAST Tree

**Input:**
```text
feat(parser)!: add ASCII art
Fixed: a bug.
Fixes: #42, @bob
```

**Tree Representation:**
```javascript
{
  type: 'root',
  breaking: true,
  children: [
    {
      type: 'header',
      children: [
        { type: 'type', value: 'feat' },
        { type: 'scope', value: 'parser' },
        { type: 'bang', children: [{ type: 'text', value: '!' }] },
        { type: 'description', breaking: true, children: [{ type: 'text', value: 'add ASCII art'}]}
      ]
    },
    {
      type: 'body',
      children: [
          {type: 'line', children: [{type: 'text', value: 'Fixed a bug.'}]}
      ]
    },
    {
      type: 'footer',
      children: [
        { 
          type: 'trailer',
          refAction: 'fixes',
          children: [
            { type: 'trailerkey', children: [{type: 'text', value: 'Fixes'}]},
            {
              type: 'trailervalue',
              children: [
                {type: 'issuereference', value: '#42', prefix: '#', id: 42},
                {type: 'text', value: ', '},
                {type: 'mention', username: 'bob', value: '@bob'}
              ]
            }
          ]
        }
      ]
    }
  ]
}
```
