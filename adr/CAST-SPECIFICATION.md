# CAST: Conventional Commit Abstract Syntax Tree

**C**onventional Commit **A**bstract **S**yntax **T**ree.

***

**cast** is a specification for representing conventional commit messages in a [syntax tree][syntax-tree].
It implements **[unist][]**.
It can represent conventional commit messages as defined by the [Conventional Commits specification][conventional-commits].

This document defines a format for representing [conventional commit messages][conventional-commits] as an [abstract syntax tree][syntax-tree].

## Contents

* [Introduction](#introduction)
* [Where this specification fits](#where-this-specification-fits)
* [Types](#types)
* [Nodes (abstract)](#nodes-abstract)
  * [`Literal`](#literal)
  * [`Parent`](#parent)
* [Nodes](#nodes)
  * [`Root`](#root)
  * [`Header`](#header)
  * [`Type`](#type)
  * [`Scope`](#scope)
  * [`Bang`](#bang)
  * [`Description`](#description)
  * [`Body`](#body)
  * [`Footer`](#footer)
  * [`Trailer`](#trailer)
  * [`TrailerKey`](#trailerkey)
  * [`TrailerValue`](#trailervalue)
  * [`Line`](#line)
  * [`Text`](#text)
  * [`IssueReference`](#issuereference)
* [Mixin](#mixin)
  * [`PositionalInfo`](#positionalinfo)
* [Content model](#content-model)
  * [`Content`](#content)
  * [`HeaderContent`](#headercontent)
  * [`BodyContent`](#bodycontent)
  * [`FooterContent`](#footercontent)
  * [`TrailerContent`](#trailercontent)
  * [`TextContent`](#textcontent)
* [Conventional Commit Mapping](#conventional-commit-mapping)
* [Round-trip Conversion](#round-trip-conversion)
* [Examples](#examples)
* [Utilities](#utilities)
* [References](#references)

## Introduction

This document defines a format for representing [conventional commit messages][conventional-commits] as an [abstract syntax tree][syntax-tree].
Development of cast started in January 2025, as part of a conventional commit parser project that needed to provide both structured JSON output and AST-based transformations.

This specification is written in a [Web IDL][webidl]-like grammar.

### Where this specification fits

cast extends [unist][], a format for syntax trees, to benefit from its [ecosystem of utilities][utilities].

cast relates to [JavaScript][] in that it has utilities for working with compliant syntax trees in JavaScript.
However, cast is not limited to JavaScript and can be used in other programming languages.

cast relates to the [unified][] ecosystem in that cast syntax trees can be used with unified processors for transformation, validation, and serialization tasks.

cast relates to [conventional commits][conventional-commits] in that it provides a structured representation of commit messages that follow the conventional commit format, enabling programmatic analysis and transformation.

## Types

If you are using TypeScript, you can use the cast types by installing them:

```sh
npm install @types/cast  # (when available)
```

## Nodes (abstract)

### `Literal`

```idl
interface Literal <: UnistLiteral {
  value: string
}
```

**Literal** ([**UnistLiteral**][dfn-unist-literal]) represents an abstract interface in cast containing a value.
Its `value` field is a `string`.

### `Parent`

```idl
interface Parent <: UnistParent {
  children: [CcAstContent]
}
```

**Parent** ([**UnistParent**][dfn-unist-parent]) represents an abstract interface in cast containing other nodes (said to be [*children*][term-child]).
Its content is limited to only other [**cast content**][dfn-cast-content].

## Nodes

### `Root`

```idl
interface Root <: Parent {
  type: 'root'
  children: [Content]
}
```

**Root** ([**Parent**][dfn-parent]) represents a conventional commit message document.
**Root** can be used as the [*root*][term-root] of a [*tree*][term-tree], never as a [*child*][term-child].
Its content model is [**content**][dfn-content].

For example, the following commit message:

```
feat(api): add user authentication

This commit adds JWT-based authentication to the API.
It includes login, logout, and token refresh endpoints.

BREAKING CHANGE: authentication is now required for all API endpoints
Resolves: #123
```

Yields:

```js
{
  type: 'root',
  children: [
    {
      type: 'header',
      children: [/* header content */]
    },
    {
      type: 'body',
      children: [/* body content */]
    },
    {
      type: 'footer',
      children: [/* footer content */]
    }
  ]
}
```

### `Header`

```idl
interface Header <: Parent {
  type: 'header'
  children: [HeaderContent]
}
```

**Header** ([**Parent**][dfn-parent]) represents the first line of a conventional commit message.
**Header** can be used where [**content**][dfn-content] is expected.
Its content model is [**header content**][dfn-header-content].

The header contains the commit type, optional scope, optional breaking change indicator, and description.

### `Type`

```idl
interface Type <: Literal {
  type: 'type'
  value: string
}
```

**Type** ([**Literal**][dfn-literal]) represents the type of change being committed.
**Type** can be used where [**header content**][dfn-header-content] is expected.
Its content is represented by its `value` field.

Common conventional commit types include: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, etc.

For example:

```js
{type: 'type', value: 'feat'}
```

### `Scope`

```idl
interface Scope <: Literal {
  type: 'scope'
  value: string
}
```

**Scope** ([**Literal**][dfn-literal]) represents the scope of the change being committed.
**Scope** can be used where [**header content**][dfn-header-content] is expected.
Its content is represented by its `value` field.

The scope is optional and appears in parentheses after the type.

For example:

```js
{type: 'scope', value: 'api'}
```

### `Bang`

```idl
interface Bang <: Parent {
  type: 'bang'
  children: [Text]
}
```

**Bang** ([**Parent**][dfn-parent]) represents a breaking change indicator in the header.
**Bang** can be used where [**header content**][dfn-header-content] is expected.
Its content model consists of a single Text node containing `'!'`.

The breaking change indicator appears as an exclamation mark (`!`) after the type or scope.
The Bang node is a syntactic element used for round-trip conversion.
The semantic meaning of a breaking change is captured by the `breaking` field on Description and Trailer nodes.

For example:

```js
{
  type: 'bang',
  children: [
    {type: 'text', value: '!'}
  ]
}
```

### `Description`

```idl
interface Description <: Parent {
  type: 'description'
  children: [TextContent]
  breaking: boolean
  value: string
}
```

**Description** ([**Parent**][dfn-parent]) represents the description of the change.
**Description** can be used where [**header content**][dfn-header-content] is expected.
Its content model is [**text content**][dfn-text-content].

The `breaking` field is `true` when the commit header contains a breaking change indicator (`!`), and `false` otherwise.

The `value` field contains the complete description text extracted from all child text nodes, providing convenient access to the description without traversing the children array.

For example:

```js
{
  type: 'description',
  breaking: false,
  value: 'add user authentication',
  children: [
    {type: 'text', value: 'add user authentication'}
  ]
}
```

Example with breaking change:

```js
{
  type: 'description',
  breaking: true,
  value: 'add user authentication',
  children: [
    {type: 'text', value: 'add user authentication'}
  ]
}
```

### `Body`

```idl
interface Body <: Parent {
  type: 'body'
  children: [BodyContent]
}
```

**Body** ([**Parent**][dfn-parent]) represents the body of the commit message.
**Body** can be used where [**content**][dfn-content] is expected.
Its content model is [**body content**][dfn-body-content].

The body provides additional context about the change and is separated from the header by a blank line.

For example:

```js
{
  type: 'body',
  children: [
    {
      type: 'line',
      children: [
        {type: 'text', value: 'This commit adds JWT-based authentication to the API.'}
      ]
    },
    {
      type: 'line',
      children: [
        {type: 'text', value: 'It includes login, logout, and token refresh endpoints.'}
      ]
    }
  ]
}
```

### `Footer`

```idl
interface Footer <: Parent {
  type: 'footer'
  children: [FooterContent]
}
```

**Footer** ([**Parent**][dfn-parent]) represents the footer section of the commit message.
**Footer** can be used where [**content**][dfn-content] is expected.
Its content model is [**footer content**][dfn-footer-content].

The footer contains git trailers and is separated from the body by a blank line.

### `Trailer`

```idl
interface Trailer <: Parent {
  type: 'trailer'
  children: [TrailerContent]
  breaking: boolean
}
```

**Trailer** ([**Parent**][dfn-parent]) represents a single git trailer in the footer.
**Trailer** can be used where [**footer content**][dfn-footer-content] is expected.
Its content model is [**trailer content**][dfn-trailer-content].

A trailer consists of a token and a value separated by a colon.

The `breaking` field is `true` when the trailer represents a breaking change (e.g., `BREAKING CHANGE:` or `BREAKING-CHANGE:`), and `false` otherwise.

For example:

```js
{
  type: 'trailer',
  breaking: false,
  children: [
    {type: 'trailerkey', children: [{type: 'text', value: 'Resolves'}]},
    {type: 'trailervalue', children: [{type: 'text', value: '#123'}]}
  ]
}
```

Breaking change trailer:

```js
{
  type: 'trailer',
  breaking: true,
  children: [
    {type: 'trailerkey', children: [{type: 'text', value: 'BREAKING CHANGE'}]},
    {type: 'trailervalue', children: [{type: 'text', value: 'API has changed'}]}
  ]
}
```

### `TrailerKey`

```idl
interface TrailerKey <: Parent {
  type: 'trailerkey'
  children: [TextContent]
}
```

**TrailerKey** ([**Parent**][dfn-parent]) represents the key part of a git trailer.
**TrailerKey** can be used where [**trailer content**][dfn-trailer-content] is expected.
Its content model is [**text content**][dfn-text-content].

Common trailer keys include: `BREAKING CHANGE`, `Resolves`, `Fixes`, `Reviewed-by`, `Co-authored-by`, etc.

For example:

```js
{
  type: 'trailerkey',
  children: [
    {type: 'text', value: 'Resolves'}
  ]
}
```

### `TrailerValue`

```idl
interface TrailerValue <: Parent {
  type: 'trailervalue'
  children: [TextContent]
}
```

**TrailerValue** ([**Parent**][dfn-parent]) represents the value part of a git trailer.
**TrailerValue** can be used where [**trailer content**][dfn-trailer-content] is expected.
Its content model is [**text content**][dfn-text-content].

### `Line`

```idl
interface Line <: Parent {
  type: 'line'
  children: [TextContent]
}
```

**Line** ([**Parent**][dfn-parent]) represents a single line of text in the body or trailer value.
**Line** can be used where [**body content**][dfn-body-content] is expected.
Its content model is [**text content**][dfn-text-content].

Lines are separated by newline characters and can contain both plain text and issue references, allowing for precise tracking of inline elements.

For example:

```js
{
  type: 'line',
  children: [
    {type: 'text', value: 'This fixes issue '},
    {type: 'issueReference', value: '#123', prefix: '#', id: 123},
    {type: 'text', value: ' in the parser'}
  ]
}
```

### `Text`

```idl
interface Text <: Literal {
  type: 'text'
  value: string
}
```

**Text** ([**Literal**][dfn-literal]) represents textual content.
**Text** can be used where [**text content**][dfn-text-content] is expected.
Its content is represented by its `value` field.

For example:

```js
{type: 'text', value: 'add user authentication'}
```

### `IssueReference`

```idl
interface IssueReference <: Literal {
  type: 'issueReference'
  value: string
  prefix: string
  id: number
}
```

**IssueReference** ([**Literal**][dfn-literal]) represents a reference to an issue or pull request.
**IssueReference** can be used where [**text content**][dfn-text-content] is expected.
Its content is represented by its `value` field, with additional `prefix` and `id` fields for structured access.

For example:

```js
{
  type: 'issueReference',
  value: '#123',
  prefix: '#',
  id: 123
}
```

## Mixin

### `PositionalInfo`

```idl
interface mixin PositionalInfo {
  position: Position?
}
```

**PositionalInfo** represents positional information of a node in the source commit message.
This mixin can be applied to any node to preserve source location information for error reporting and source mapping.

All CAST nodes **should** include position information when parsed from source text to enable:
- Precise error reporting with line and column numbers
- Source mapping for transformations
- IDE integrations with hover information and diagnostics
- Linting tools with exact error locations

#### `Position`

```idl
interface Position {
  start: Point
  end: Point
}
```

**Position** represents the location of a node in a source commit message.
The `start` field represents the place of the first character of the node.
The `end` field represents the place of the first character after the node.

#### `Point`

```idl
interface Point {
  line: number >= 1
  column: number >= 1
  offset: number >= 0
}
```

**Point** represents one place in a source commit message.
The `line` field (1-indexed integer) represents a line in the source.
The `column` field (1-indexed integer) represents a column in the source.
The `offset` field (0-indexed integer) represents a character in the source.

#### Position Mapping Guidelines

When converting from CST to CAST, position information should be preserved as follows:

1. **Token-based nodes** (Type, Scope): Use exact token positions
2. **Composite nodes** (Header, Body, Footer, TrailerKey, TrailerValue): Span from first to last child
3. **Text nodes**: Preserve exact character ranges including whitespace
4. **Issue references**: Use substring positions within trailer values

Position information is **optional** but **strongly recommended** for nodes parsed from source text.

## Content model

```idl
type CcAstContent = Content
```

Each node in ccast falls into one or more categories of **Content** that group nodes with similar characteristics together.

### `Content`

```idl
type Content = Header | Body | Footer
```

**Content** represents the top-level sections of a conventional commit message.

### `HeaderContent`

```idl
type HeaderContent = Type | Scope | Bang | Description
```

**Header content** represents the components that can appear in the commit header.

### `BodyContent`

```idl
type BodyContent = Line
```

**Body content** represents the content that can appear in the commit body.
Body content consists of line nodes, which can contain text and issue references.

### `FooterContent`

```idl
type FooterContent = Trailer
```

**Footer content** represents the content that can appear in the commit footer.

### `TrailerContent`

```idl
type TrailerContent = TrailerKey | TrailerValue
```

**Trailer content** represents the components of a git trailer.

### `TextContent`

```idl
type TextContent = Text | IssueReference
```

**Text content** represents textual content that may contain issue references.

## Conventional Commit Mapping

This section maps elements of the [Conventional Commits specification][conventional-commits] to ccast nodes:

| Conventional Commit Element | CAST Node | Description |
|----------------------------|------------|-------------|
| `<type>` | `Type` | The type of change (feat, fix, etc.) |
| `(<scope>)` | `Scope` | Optional scope in parentheses |
| `!` | `Bang` | Breaking change indicator |
| `<description>` | `Description` | Short description of the change |
| Body paragraph | `Body` | Extended description |
| `<token>: <value>` | `Trailer` | Git trailer (footer) |
| `BREAKING CHANGE:` | `Trailer` (special) | Breaking change description |
| `#123`, `GH-456` | `IssueReference` | Issue/PR references |

## Round-trip Conversion

The ccast specification is designed to support lossless round-trip conversion:

1. **Parse**: Commit message text → CAST
2. **Transform**: Modify the CAST (validate, lint, reformat)
3. **Serialize**: CAST → Commit message text

Key design principles for round-trip compatibility:

- **Preserve whitespace**: Significant whitespace is preserved in `Text` nodes
- **Maintain structure**: All structural elements are represented as nodes
- **Position tracking**: Optional positional information preserves source locations
- **No information loss**: All parts of the original commit message are represented

## Examples

### Simple feature commit

Input:
```
feat: add user authentication
```

AST:
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

### Complex commit with breaking change

Input:
```
feat(api)!: add user authentication

This commit adds JWT-based authentication to the API.
It includes login, logout, and token refresh endpoints.

BREAKING CHANGE: authentication is now required for all API endpoints
Resolves: #123
Co-authored-by: Jane Doe <jane@example.com>
```

AST:
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
        {type: 'bang', value: '!'},
        {type: 'description', breaking: true, value: 'add user authentication', children: [
          {type: 'text', value: ' add user authentication'}
        ]}
      ]
    },
    {
      type: 'body',
      children: [
        {type: 'text', value: 'This commit adds JWT-based authentication to the API.\nIt includes login, logout, and token refresh endpoints.'}
      ]
    },
    {
      type: 'footer',
      children: [
        {
          type: 'trailer',
          breaking: true,
          children: [
            {type: 'trailerkey', children: [{type: 'text', value: 'BREAKING CHANGE'}]},
            {type: 'trailervalue', children: [
              {type: 'text', value: ' authentication is now required for all API endpoints'}
            ]}
          ]
        },
        {
          type: 'trailer',
          breaking: false,
          children: [
            {type: 'trailerkey', children: [{type: 'text', value: 'Resolves'}]},
            {type: 'trailervalue', children: [
              {type: 'issueReference', value: '#123', prefix: '#', id: 123}
            ]}
          ]
        },
        {
          type: 'trailer',
          breaking: false,
          children: [
            {type: 'trailerkey', children: [{type: 'text', value: 'Co-authored-by'}]},
            {type: 'trailervalue', children: [
              {type: 'text', value: ' Jane Doe <jane@example.com>'}
            ]}
          ]
        }
      ]
    }
  ]
}
```

## Utilities

**Utilities** are functions that work with ccast nodes. The ccast ecosystem includes:

- **Parsers**: Convert commit message text to CAST
- **Serializers**: Convert CAST to commit message text  
- **Validators**: Validate conventional commit structure and rules
- **Transformers**: Modify commit messages programmatically
- **Linters**: Check for style and convention violations
- **Extractors**: Extract metadata (issues, breaking changes, etc.)

Example utilities:

- `ccast-util-from-string` — parse commit message text
- `ccast-util-to-string` — serialize CAST to text
- `ccast-util-validate` — validate conventional commit rules
- `ccast-util-extract-issues` — extract issue references
- `ccast-util-extract-breaking` — extract breaking changes
- `ccast-util-normalize` — normalize formatting
- `ccast-util-lint` — lint commit messages

## References

- **unist**: [Universal Syntax Tree][unist]. T. Wormer; et al.
- **Conventional Commits**: [Conventional Commits][conventional-commits]. 
- **Git Trailers**: [Git Trailers Documentation](https://git-scm.com/docs/git-interpret-trailers)
- **JavaScript**: [ECMAScript Language Specification][javascript]. Ecma International.
- **Web IDL**: [Web IDL][webidl], C. McCormack. W3C.

[unist]: https://github.com/syntax-tree/unist
[syntax-tree]: https://github.com/syntax-tree/unist#syntax-tree
[conventional-commits]: https://conventionalcommits.org/
[utilities]: https://github.com/syntax-tree/unist#list-of-utilities
[unified]: https://github.com/unifiedjs/unified
[javascript]: https://www.ecma-international.org/ecma-262/9.0/index.html
[webidl]: https://heycam.github.io/webidl/

[dfn-unist-literal]: https://github.com/syntax-tree/unist#literal
[dfn-unist-parent]: https://github.com/syntax-tree/unist#parent
[dfn-node]: https://github.com/syntax-tree/unist#node
[dfn-literal]: #literal
[dfn-parent]: #parent
[dfn-ccast-content]: #content-model
[dfn-content]: #content
[dfn-header-content]: #headercontent
[dfn-body-content]: #bodycontent
[dfn-footer-content]: #footercontent
[dfn-trailer-content]: #trailercontent
[dfn-text-content]: #textcontent

[term-tree]: https://github.com/syntax-tree/unist#tree
[term-child]: https://github.com/syntax-tree/unist#child
[term-root]: https://github.com/syntax-tree/unist#root
