'use strict'

/**
 * @module lib/parse-chunks
 * @description Integrated parsing using pre-chunking and section-specific parsing
 */

const {Lexer} = require('chevrotain')
const node = require('./cast/node/index.js')
const {ConventionalCommitParser, createConfigurableTokens} = require('./parser.js')
const ConventionalCommitVisitor = require('./visitor.js')
const {chunkCommitMessage, adjustTokenPositions} = require('./chunker.js')
const {BREAKING_CHANGES, ISSUE_PREFIXES} = require('./constants.js')
const {
  BLANK_LINE
, NEW_LINE
, WHITE_SPACE
, LINE_TEXT
} = require('./tokens.js')

module.exports = {
  parseCommitMessage
}

/**
 * Create tokens for header parsing (excludes breaking change, body text, and issue tokens)
 * @param {Object} config - Configuration options
 * @returns {Array} Array of tokens for header parsing
 */
function createHeaderTokens(config = {
  notesPhrase: BREAKING_CHANGES
, issuePrefix: ISSUE_PREFIXES
}) {
  // Get all tokens but filter out tokens not needed for header parsing:
  // - BREAKING_CHANGE_TOKEN: Not used in header (only in footers)
  // - LINE_TEXT: Would match structural tokens like "feat!:" incorrectly
  // - ISSUE_PREFIX and ISSUE_ID: Issue references only parsed in footers
  const allTokens = createConfigurableTokens(config)
  return allTokens.filter((token) => {
    return token.name !== 'BREAKING_CHANGE_TOKEN'
      && token.name !== 'LINE_TEXT'
      && token.name !== 'ISSUE_PREFIX'
      && token.name !== 'ISSUE_ID'
  })
}

/**
 * Create tokens for body parsing (excludes footer tokens to avoid conflicts)
 * Body is treated as an opaque blob per the spec - no issue reference parsing
 * @returns {Array} Array of tokens for body parsing
 */
function createBodyTokens() {
  return [
    BLANK_LINE
  , NEW_LINE
  , WHITE_SPACE
  , LINE_TEXT // Permissive text token (allows ()!: characters) - replaces TEXT in body context
  ]
}

/**
 * Parse a commit message using the pre-chunking approach
 * @param {string} message - Commit message to parse
 * @param {Object} config - Configuration options
 * @param {string[]} config.notesPhrase - Array of breaking change phrases
 * @param {string[]} config.issuePrefix - Array of issue prefixes
 * @returns {Object} AST representation of the commit message
 */
function parseCommitMessage(message, config = {
  notesPhrase: BREAKING_CHANGES
, issuePrefix: ISSUE_PREFIXES
}) {
  // Step 1: Chunk the commit message into sections
  const chunks = chunkCommitMessage(message, config)

  // Step 2: Create parser and visitor instances
  const parser = new ConventionalCommitParser(config)
  const visitor = new ConventionalCommitVisitor()

  // Step 3: Parse each section individually
  const parsed_sections = {}

  // Parse header (always present) using header-specific tokens
  if (chunks.header) {
    const header_lexer = new Lexer(createHeaderTokens(config))
    const tokens = header_lexer.tokenize(chunks.header.content)
    const adjusted_header_tokens = adjustTokenPositions(tokens.tokens, chunks.header)

    // Parse header using parametrized commit rule
    parser.input = adjusted_header_tokens
    const header_cst = parser.commit('header')
    // Visit the header CST node directly (not the commit wrapper)
    const header_ast = visitor.visit(header_cst.children.header[0])

    parsed_sections.header = header_ast
  }

  // Parse body if present using body-specific tokens (no footer tokens)
  if (chunks.body) {
    const body_lexer = new Lexer(createBodyTokens())
    const tokens = body_lexer.tokenize(chunks.body.content)
    const adjusted_body_tokens = adjustTokenPositions(tokens.tokens, chunks.body)

    // Parse body using parametrized commit rule
    parser.input = adjusted_body_tokens
    const body_cst = parser.commit('body')
    // Visit the body CST node directly (not the commit wrapper)
    const body_ast = visitor.visit(body_cst.children.body[0])

    parsed_sections.body = body_ast
  }

  // Parse footer if present using parser's token array (excluding TEXT to avoid conflicts)
  if (chunks.footer) {
    // Filter out TEXT from footer tokens to avoid conflicts with LINE_TEXT
    // LINE_TEXT is more permissive and better suited for opaque trailer values
    const footer_tokens = parser.tokens.filter((token) => {
      return token.name !== 'TEXT'
    })
    const footer_lexer = new Lexer(footer_tokens)
    const tokens = footer_lexer.tokenize(chunks.footer.content)
    const adjusted_footer_tokens = adjustTokenPositions(tokens.tokens, chunks.footer)

    // Parse footer using parametrized commit rule
    parser.input = adjusted_footer_tokens
    const footer_cst = parser.commit('footer')

    // Check for parser errors
    if (parser.errors.length > 0) {
      const error_messages = parser.errors.map((err) => {
        return err.message
      }).join('; ')
      throw new Error(`Footer parsing failed: ${error_messages}`)
    }

    // Visit the trailers CST node directly (not the commit wrapper)
    // Check if trailers exist in the CST before accessing
    if (footer_cst.children.trailers && footer_cst.children.trailers.length > 0) {
      const footer_ast = visitor.visit(footer_cst.children.trailers[0])
      parsed_sections.footer = footer_ast
    }
  }

  // Step 4: Combine sections into final AST
  const children = []
  let breaking = false

  // Add header
  if (parsed_sections.header) {
    children.push(parsed_sections.header)

    // Check if header indicates breaking change (via description.breaking)
    if (parsed_sections.header.children.some((child) => {
      return child.type === 'description' && child.breaking
    })) {
      breaking = true
    }
  }

  // Add body if present
  if (parsed_sections.body) {
    children.push(parsed_sections.body)
  }

  // Add footer if present
  if (parsed_sections.footer) {
    children.push(parsed_sections.footer)

    // Check for breaking change trailers
    if (parsed_sections.footer.children.some((child) => {
      return child.breaking
    })) {
      breaking = true
    }
  }

  // Create root node (similar to visitor's commit method)
  return node.root({breaking}, children)
}
