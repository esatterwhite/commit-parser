# Conventional Commit Parser

A parser for conventional commit messages built with Chevrotain.

## Features

- Parse conventional commit messages according to the specification
- Generate AST (Abstract Syntax Tree) output
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

# Generate and open diagrams (macOS)
npm run diagrams:open
```

The generated `conventional-commit-grammar-diagrams.html` file will show interactive railroad diagrams for all grammar rules, making it easy to understand the parser's structure and debug parsing issues.

## Scripts

- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run diagrams` - Generate railroad diagrams
- `npm run diagrams:open` - Generate and open diagrams

## Development

The parser is built using:
- [Chevrotain](https://chevrotain.io/) - Parser building toolkit
- [Tap](https://node-tap.org/) - Testing framework

See the `lib/` directory for implementation details:
- `lib/parser.js` - Main parser grammar
- `lib/tokens.js` - Token definitions
- `lib/visitor.js` - AST visitor
- `lib/chunker.js` - Pre-processing chunker

