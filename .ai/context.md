# Project Context: conventional-commit-parser

This repository implements a parser for Conventional Commit messages that transforms them into a structured Abstract Syntax Tree (AST) called **CAST** (Conventional Commit Abstract Syntax Tree).

## Quick Start

### Essential Commands
- `npm test`: Runs the test suite using `tap`.
- `npm run lint`: Lints the codebase using `eslint`.
- `npm run lint:fix`: Automatically fixes linting errors.
- `npm run generate`: Executes `scripts/generate.js`.

## Architecture

The project follows a multi-stage pipeline to convert raw commit text into a CAST AST:

### 1. Pre-Chunking (`lib/chunker.js`)
Because conventional commits have ambiguous boundaries (especially the footer), the parser uses a `PreParser` to split the message into three primary sections before formal parsing begins:
- **Header**: The first line.
- **Body**: Everything between the header and footer.
- **Footer**: The last chunk, provided it contains only "trailers" (key-value pairs).

### 2. Section-Specific Parsing (`lib/cast/parser.js`)
The project uses `chevrotain` for parsing. Instead of a single monolithic grammar, the `ConventionalCommitParser` supports **parametrized rules**. The `parseSection` method in `lib/parse-chunks.js` instructs the parser which specific section (header, body, or footer) it is currently processing.

### 3. AST Transformation (`lib/cast/visitor/ast.js`)
The output of Chevrotain is a Concrete Syntax Tree (CST). A `ConventionalCommitVisitor` traverses this CST and uses factory functions in `lib/cast/node/` to produce a **CAST** AST.

## CAST Specification (Abstract Syntax Tree)

CAST implements the `unist` (Universal Syntax Tree) ecosystem. This allows the parser's output to be compatible with a wide range of unist utilities.

- **Root Node**: `type: 'root'`, contains a `breaking` boolean flag.
- **Main Sections**: `header`, `body`, and `footer`.
- **Positional Info**: Every node includes a `position` object (start/end offset, line, and column) mapped from Chevrotain tokens via `lib/cast/position.js`.
- **Node Types**: 
    - `type`, `scope`, `description`, `bang`, `text`, `line`, `issuereference`, `mention`, `trailer`, etc.

## Development Patterns & Conventions

### Token Management (`lib/cast/tokens.js`)
Tokens are centralized and configurable. Breaking change phrases and issue reference prefixes (e.g., `#`, `GH-`) can be customized via options passed to the parser.

### Position Mapping
Since Chevrotain uses 1-based indexing and different offset logic than unist, always use the utilities in `lib/cast/position.js` (`tokenToPosition`, `tokensToPosition`, `spanPosition`) when creating AST nodes.

### Naming & Style
- **CommonJS**: The project uses `require` and `module.exports`.
- **Strict Mode**: All files start with `'use strict'`.
- **Node Factories**: Use the factories in `lib/cast/node/` rather than creating unist nodes manually to ensure consistency across the AST.


### coding standards
- commas should be placed at the beginning of a line rather than the end
- add jsdoc comments for modules, exported functions and classes
- follow the existing folder structure and naming conventions
- function names should be camel cased
- variable names should be snake cased
- environment variables should always use the @logdna/env-config package referenced in the config.js file at the root of the project
- prefer composition over inheritence
- avoid using classes unless complex state management is required
- linting rules found in the shared eslint configuration eslint-config-logdna should be followed and applied. The command 'npm run lint:fix' should pass with an exit code of 0
- class names should be upper camel case, FooBar
- function names should be standard camel case, fooBar
- all other variable names should be snake case, foo_bar
- When testing, mocking should be avoided unless strictly necessary. Interfacing with a live data store, or external service is preferable


## Gotchas & Non-Obvious Details

- **Footer Detection**: A chunk is only considered a footer if *all* its non-empty lines match the trailer pattern (`Key: Value`). If one line fails, the entire chunk is treated as part of the body.
- **Parametrized Rules**: The `commit` rule in `lib/cast/parser.js` uses `GATE` functions to switch between different parsing modes based on the `section` argument.
- **Opaque Blobs**: While the header is strictly parsed, the body is treated as an "opaque blob" (mostly just lines of text) per the Conventional Commits specification.

## Reference Documents
Detailed design decisions and specifications are located in the `adr/` directory:
- `adr/CAST-SPECIFICATION.md`: The formal definition of the AST.
- `adr/PARSING-NOTES.md`: Technical notes on the parsing strategy.
