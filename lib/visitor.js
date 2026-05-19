'use strict'

/**
 * @module lib/visitor
 * @description Visitor for transforming CST to CAST AST representation
 */

const {ConventionalCommitParser} = require('./parser.js')
const {
  tokenToPosition
, createRoot
, createHeader
, createType
, createScope
, createBang
, createDescription
, createBody
, createFooter
, createTrailer
, createTrailerKey
, createTrailerValue
, createLine
, createText
, createIssueReference
, parseTextWithIssues
} = require('./ast-nodes.js')

// Create a temporary parser instance to get the base visitor
const temp_parser = new ConventionalCommitParser()
const BaseCstVisitor = temp_parser.getBaseCstVisitorConstructor()

/**
 * Visitor class for converting CST to CAST AST
 * @class ConventionalCommitVisitor
 * @extends BaseCstVisitor
 */
class ConventionalCommitVisitor extends BaseCstVisitor {
  constructor() {
    super()
    this.validateVisitor()
  }

  commit(ctx) {
    const children = []
    let breaking = false

    // Visit header
    const header = this.visit(ctx.header)
    children.push(header)

    // Check if header has a description with breaking: true
    breaking = header.children.some((child) => {
      return child.type === 'description' && child.breaking
    })

    // Visit body if present
    if (ctx.body) {
      const body = this.visit(ctx.body)
      children.push(body)
    }

    // Visit footers if present
    if (ctx.footers) {
      const footer = this.visit(ctx.footers)
      children.push(footer)

      // Check for breaking change trailers
      if (!breaking) {
        breaking = footer.children.some((child) => {
          return child.breaking
        })
      }
    }
    return createRoot(children, breaking)
  }

  header(ctx) {
    // Header now has two alternatives: conventionalHeader or description
    if (ctx.conventionalHeader) {
      return this.visit(ctx.conventionalHeader[0])
    } else if (ctx.description) {
      // Non-conventional commit: just description
      const description_node = this.visit(ctx.description[0])
      return createHeader([description_node])
    }

    return createHeader([])
  }

  conventionalHeader(ctx) {
    const children = []

    // Track if this is a breaking change (BANG present)
    const has_breaking = !!ctx.BANG

    // Add type node
    if (ctx.type) {
      const type_node = this.visit(ctx.type[0])
      children.push(type_node)
    }

    // Add scope node with parentheses if present
    if (ctx.scope) {
      const scope_with_parens = this.visit(ctx.scope[0])
      // Add all children from the scope (parentheses and scope content)
      children.push(...scope_with_parens.children)
    }

    // Add breaking change indicator if present
    if (ctx.BANG) {
      const bang_token = ctx.BANG[0]
      const bang_node = createBang(tokenToPosition(bang_token))
      children.push(bang_node)
    }

    // Add colon
    if (ctx.COLON) {
      const colon_token = ctx.COLON[0]
      const text_node = createText(':', tokenToPosition(colon_token))
      children.push(text_node)
    }

    // Add whitespace after colon if present
    if (ctx.WHITE_SPACE) {
      const ws_token = ctx.WHITE_SPACE[0]
      const text_node = createText(' ', tokenToPosition(ws_token))
      children.push(text_node)
    }

    // Add description node with breaking flag
    if (ctx.description) {
      const description_node = this.visit(ctx.description[0], has_breaking)
      children.push(description_node)
    }

    return createHeader(children)
  }

  type(ctx) {
    // Type can be either TEXT or FOOTER_TOKEN
    const token = ctx.TEXT ? ctx.TEXT[0] : ctx.FOOTER_TOKEN[0]
    return createType(token.image, tokenToPosition(token))
  }

  scope(ctx) {
    const children = []

    // Add opening parenthesis
    if (ctx.LPAREN) {
      children.push(createText('(', tokenToPosition(ctx.LPAREN[0])))
    }

    // Add scope content using helper functions
    const scope_tokens = collectTokens(ctx, ['TEXT', 'WHITE_SPACE'])
    if (scope_tokens.length > 0) {
      const scope_value = toText(scope_tokens)
      const scope_position = toPosition(scope_tokens)
      children.push(createScope(scope_value, scope_position))
    }

    // Add closing parenthesis
    if (ctx.RPAREN) {
      children.push(createText(')', tokenToPosition(ctx.RPAREN[0])))
    }

    // Return the scope node and parentheses as separate children to be added to header
    return {
      type: 'scope_with_parens'
    , children
    }
  }

  description(ctx, breaking = false) {
    // Use helper functions to collect and process tokens
    const all_tokens = collectTokens(ctx, ['TEXT', 'WHITE_SPACE'])
    if (!all_tokens.length) return createDescription([], breaking, '')

    const full_text = toText(all_tokens)
    const description_position = toPosition(all_tokens)

    const text_nodes = parseTextWithIssues(full_text, description_position)

    // Extract the value text from all text nodes
    const value = text_nodes.map((node) => {
      return node.value
    }).join('')

    return createDescription(text_nodes, breaking, value, description_position)
  }

  body(ctx) {
    // Process both bodyLine nodes and BLANK_LINE tokens to preserve empty lines
    const body_lines = ctx.bodyLine || []
    const blank_lines = ctx.BLANK_LINE || []

    // Combine and sort by position to maintain order
    const all_items = []

    // Add bodyLine nodes
    for (const body_line of body_lines) {
      const line_node = this.visit(body_line)
      if (line_node) {
        all_items.push({
          type: 'line'
        , node: line_node
        , offset: line_node.position?.start?.offset || 0
        })
      }
    }

    // Add BLANK_LINE tokens as line nodes with empty text
    for (const blank_token of blank_lines) {

      // Create empty text node to represent blank line
      const text_node = createText('', tokenToPosition(blank_token))

      // Calculate line position
      const position = {
        start: {
          line: blank_token.startLine || 1
        , column: blank_token.startColumn || 1
        , offset: blank_token.startOffset || 0
        }
      , end: {
          line: blank_token.endLine || blank_token.startLine || 1
        , column: (blank_token.endColumn || blank_token.startColumn || 1) + 1
        , offset: (blank_token.endOffset || blank_token.startOffset || 0) + 1
        }
      }

      all_items.push({
        type: 'blank'
      , node: createLine([text_node], position)
      , offset: blank_token.startOffset || 0
      })
    }

    // Sort by offset to maintain original order
    all_items.sort((a, b) => {
      return a.offset - b.offset
    })

    const line_nodes = []
    for (const item of all_items) {
      line_nodes.push(item.node)
    }

    return createBody(line_nodes)
  }

  bodyLine(ctx) {
    // Body is an opaque blob per the spec - no issue reference parsing
    // Collect BODY_TEXT and WHITE_SPACE tokens (not NEW_LINE - that's just a separator)
    const all_tokens = collectTokens(ctx, ['BODY_TEXT', 'WHITE_SPACE'])
    if (!all_tokens.length) return createLine([])

    const full_text = toText(all_tokens)
    const line_position = toPosition(all_tokens)

    // Create a single text node without parsing for issue references
    const text_node = createText(full_text, line_position)

    return createLine([text_node], line_position)
  }

  issueReference(ctx) {
    // This visitor is no longer used since we parse issue references from text
    // Keep it for compatibility with parser validation
    const prefix_token = ctx.ISSUE_PREFIX?.[0]
    const number_token = ctx.ISSUE_NUMBER?.[0]

    if (!prefix_token || !number_token) return null

    const prefix = prefix_token.image
    const number = number_token.image
    const value = prefix + number
    const id = parseInt(number, 10)

    // Calculate position spanning both tokens
    const position = {
      start: {
        line: prefix_token.startLine || 1
      , column: prefix_token.startColumn || 1
      , offset: prefix_token.startOffset || 0
      }
    , end: {
        line: number_token.endLine || number_token.startLine || 1
      , column: (number_token.endColumn || number_token.startColumn || 1) + 1
      , offset: (number_token.endOffset || number_token.startOffset || 0) + 1
      }
    }

    return createIssueReference(value, prefix, id, position)
  }

  footers(ctx) {
    const trailers = ctx.footer.map((footer) => {
      return this.visit(footer)
    })
    return createFooter(trailers)
  }

  footer(ctx) {
    const children = []
    let breaking = false

    // Create trailer key node
    if (ctx.BREAKING_CHANGE_TOKEN) {
      const token = ctx.BREAKING_CHANGE_TOKEN[0]
      const text_nodes = parseTextWithIssues(token.image, tokenToPosition(token))
      const key_node = createTrailerKey(text_nodes)
      children.push(key_node)
      breaking = true
    } else if (ctx.FOOTER_TOKEN) {
      const token = ctx.FOOTER_TOKEN[0]
      const text_nodes = parseTextWithIssues(token.image, tokenToPosition(token))
      const key_node = createTrailerKey(text_nodes)
      children.push(key_node)
    }

    // Add colon as text node
    if (ctx.COLON) {
      const colon_token = ctx.COLON[0]
      const text_node = createText(':', tokenToPosition(colon_token))
      children.push(text_node)
    }

    // Add whitespace after colon if present
    if (ctx.WHITE_SPACE) {
      const ws_token = ctx.WHITE_SPACE[0]
      const text_node = createText(' ', tokenToPosition(ws_token))
      children.push(text_node)
    }

    // Create trailer value node
    const value_node = this.visit(ctx.footerValue)
    children.push(value_node)

    return createTrailer(children, breaking)
  }

  footerValue(ctx) {
    // Collect all children from all lines
    const all_children = []

    for (const line of ctx.footerValueLine) {
      const line_children = this.visit(line)
      all_children.push(...line_children)
    }

    return createTrailerValue(all_children)
  }

  footerValueLine(ctx) {
    // Collect all items (tokens and issue references) with their positions
    const items = []

    // Collect TEXT tokens
    if (ctx.TEXT) {
      for (const token of ctx.TEXT) {
        items.push({
          type: 'token'
        , token
        , offset: token.startOffset || 0
        })
      }
    }

    // Collect WHITE_SPACE tokens
    if (ctx.WHITE_SPACE) {
      for (const token of ctx.WHITE_SPACE) {
        items.push({
          type: 'token'
        , token
        , offset: token.startOffset || 0
        })
      }
    }

    // Collect issue references
    if (ctx.issueReference) {
      for (const ref_ctx of ctx.issueReference) {
        const ref_node = this.visit(ref_ctx)
        items.push({
          type: 'issueReference'
        , node: ref_node
        , offset: ref_node.position?.start?.offset || 0
        })
      }
    }

    // Sort by position to maintain order
    items.sort((a, b) => {
      return a.offset - b.offset
    })

    // Consolidate consecutive tokens into single text nodes
    const children = []
    let text_buffer = []
    let first_token = null

    for (const item of items) {
      if (item.type === 'token') {
        // Buffer text tokens
        if (!first_token) first_token = item.token
        text_buffer.push(item.token.image)
      } else {
        // Flush text buffer before adding issue reference
        if (text_buffer.length > 0) {
          const text_value = text_buffer.join('')
          const text_position = {
            start: {
              line: first_token.startLine || 1
            , column: first_token.startColumn || 1
            , offset: first_token.startOffset || 0
            }
          , end: {
              line: item.node.position.start.line
            , column: item.node.position.start.column
            , offset: item.node.position.start.offset
            }
          }
          children.push(createText(text_value, text_position))
          text_buffer = []
          first_token = null
        }
        // Add issue reference
        children.push(item.node)
      }
    }

    // Flush any remaining text buffer
    if (text_buffer.length > 0) {
      const last_token = items[items.length - 1].token
      const text_value = text_buffer.join('')
      const text_position = {
        start: {
          line: first_token.startLine || 1
        , column: first_token.startColumn || 1
        , offset: first_token.startOffset || 0
        }
      , end: {
          line: last_token.endLine || last_token.startLine || 1
        , column: (last_token.endColumn || last_token.startColumn || 1) + 1
        , offset: (last_token.endOffset || last_token.startOffset || 0) + 1
        }
      }
      children.push(createText(text_value, text_position))
    }

    return children
  }
}

module.exports = ConventionalCommitVisitor

/**
 * Collect and sort tokens from context by type
 * @param {object} ctx - Context object with token arrays
 * @param {Array<string>} tokenTypes - Token type names to collect
 * @returns {Array} Sorted array of tokens
 */
function collectTokens(ctx, tokenTypes) {
  const tokens = []
  for (const tokenType of tokenTypes) {
    if (ctx[tokenType]) {
      tokens.push(...ctx[tokenType])
    }
  }
  // Sort by position to maintain order
  tokens.sort((a, b) => {
    return (a.startOffset || 0) - (b.startOffset || 0)
  })
  return tokens
}

/**
 * Reconstruct text from tokens
 * @param {Array} tokens - Array of tokens
 * @returns {string} Reconstructed text
 */
function toText(tokens) {
  return tokens.map((token) => {
    return token.image
  }).join('')
}

/**
 * Calculate position from first and last tokens
 * @param {Array} tokens - Array of tokens
 * @returns {object|undefined} Position object or undefined if no tokens
 */
function toPosition(tokens) {
  if (!tokens || tokens.length === 0) return undefined

  const first_token = tokens[0]
  const last_token = tokens[tokens.length - 1]

  return {
    start: {
      line: first_token.startLine || 1
    , column: first_token.startColumn || 1
    , offset: first_token.startOffset || 0
    }
  , end: {
      line: last_token.endLine || last_token.startLine || 1
    , column: (last_token.endColumn || last_token.startColumn || 1) + 1
    , offset: (last_token.endOffset || last_token.startOffset || 0) + 1
    }
  }
}

