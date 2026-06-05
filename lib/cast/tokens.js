'use strict'

/**
 * @module lib/tokens
 * @description Centralized token management for the conventional commit parser
 * Provides token definitions, configuration, and section-specific filtering
 */

const {createToken, Lexer} = require('chevrotain')
const {BREAKING_CHANGES, ISSUE_PREFIXES, REFERENCE_ACTIONS} = require('../constants.js')

// ============================================
// Pattern Matchers
// ============================================

/**
 * Creates a RegExp pattern for configurable breaking change phrases
 * @param {object} config - Configuration with notesPhrase array
 * @returns {RegExp} Regular expression for matching breaking change phrases
 */
function createBreakingChangeMatcher(config) {
  // Create a combined regex pattern for all breaking change phrases
  const patterns = config.notesPhrase.map((phrase) => {
    // Escape special regex characters for exact matching
    return phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  })

  // Sort by length (longest first) to avoid false matches
  patterns.sort((a, b) => {
    return b.length - a.length
  })

  // Chevrotain doesn't allow ^
  const combined_pattern = patterns.join('|')
  return new RegExp(`(${combined_pattern})`)
}

/**
 * Creates a RegExp pattern for configurable reference action keys
 * @param {object} config - Configuration with referenceActions array
 * @returns {RegExp} Regular expression for matching reference action keys (case-insensitive)
 */
function createReferenceActionMatcher(config) {
  const actions = config.referenceActions ?? REFERENCE_ACTIONS

  if (!actions?.length) return /(?!)/

  const patterns = actions.map((action) => {
    return action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  })

  patterns.sort((a, b) => {
    return b.length - a.length
  })

  const combined_pattern = patterns.join('|')
  // Case-insensitive match for the key, ensuring it's followed by optional space and colon
  return new RegExp(`(${combined_pattern})(?=[ \t]*:)`, 'i')
}

/**
 * Creates a RegExp pattern for configurable issue prefixes
 * @param {object} config - Configuration with issuePrefix array
 * @returns {RegExp} Regular expression for matching issue prefixes with lookahead for alphanumeric
 */
function createIssuePrefixMatcher(config) {
  // Default to '#' if no prefixes specified
  const prefixes = config.issuePrefix || ['#']

  // Create a combined regex pattern for all issue prefixes
  const patterns = prefixes.map((prefix) => {
    // Escape special regex characters for exact matching
    return prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  })

  // Sort by length (longest first) to avoid false matches
  patterns.sort((a, b) => {
    return b.length - a.length
  })

  // Add lookahead for alphanumeric characters (issue references are <prefix><alphanumeric>)
  const combined_pattern = patterns.join('|')
  return new RegExp(`(${combined_pattern})(?=[A-Za-z0-9])`)
}

// ============================================
// Base Token Definitions
// ============================================

// Whitespace and structural tokens
const BLANK_LINE = createToken({
  name: 'BLANK_LINE'
, pattern: /\n[ \t]*\n/
, line_breaks: true
})

const NEW_LINE = createToken({
  name: 'NEW_LINE'
, pattern: /\n/
, line_breaks: true
})

const WHITE_SPACE = createToken({
  name: 'WHITE_SPACE'
, pattern: /[ \t]+/
, group: Lexer.SKIPPED
})

// Simple structural tokens
const LPAREN = createToken({
  name: 'LPAREN'
, pattern: /\(/
, label: '('
})

const RPAREN = createToken({
  name: 'RPAREN'
, pattern: /\)/
, label: ')'
})

const BANG = createToken({
  name: 'BANG'
, pattern: /!/
, label: '!'
})

const COLON = createToken({
  name: 'COLON'
, pattern: /:/
, label: ':'
})

const COMMA = createToken({
  name: 'COMMA'
, pattern: /,/
, label: ','
, group: Lexer.SKIPPED
})

const AT = createToken({
  name: 'at'
, pattern: /@/
, label: '@'
})

const SLASH = createToken({
  name: 'slash'
, pattern: /\//
, label: '/'
})

// Structured text token for parsing type and scope
// Excludes structural characters that have meaning in header context
const TEXT = createToken({
  name: 'TEXT'
, pattern: /[^\s()!:\n]+/
})

// Opaque line text token for content that isn't parsed for structure
// Used for: descriptions, body lines, and trailer values
// More permissive than TEXT - includes structural chars like ()!:,
const LINE_TEXT = createToken({
  name: 'LINE_TEXT'
, pattern: /[^\s\n]+/
})

// Footer tokens - base definition without configuration
const FOOTER_TOKEN = createToken({
  name: 'FOOTER_TOKEN'
, pattern: /[A-Za-z]+([-][A-Za-z]+)*(?=[ \t]*:)/
})

const IDENTIFIER = createToken({
  name: 'identifier'
, pattern: /[\w-]+/
})

// ============================================
// Token Vocabulary Creation
// ============================================

/**
 * Creates a complete token vocabulary with configurable tokens
 * @param {object} config - Configuration object
 * @param {string[]} config.notesPhrase - Breaking change phrases
 * @param {string[]} config.issuePrefix - Issue reference prefixes
 * @returns {object} Object with token names as keys and token instances as values
 * Token order is preserved via V8's insertion order guarantee
 */
function createTokenVocabulary(config = {
  notesPhrase: BREAKING_CHANGES
, issuePrefix: ISSUE_PREFIXES
, referenceActions: REFERENCE_ACTIONS
}) {
  // Create custom breaking change token with configuration
  const BREAKING_CHANGE_TOKEN = createToken({
    name: 'BREAKING_CHANGE_TOKEN'
  , pattern: createBreakingChangeMatcher(config)
  , label: 'BREAKING CHANGE'
  , longer_alt: FOOTER_TOKEN
    // Performance optimization hint
  , start_chars_hint: Array.from(
      new Set(
        config.notesPhrase.map((phrase) => {
          return phrase[0]
        }).filter(Boolean)
      )
    )
  , line_breaks: false
  })

  // Create custom reference action token with configuration
  const REFERENCE_ACTION_TOKEN = createToken({
    name: 'REFERENCE_ACTION_TOKEN'
  , pattern: createReferenceActionMatcher(config)
  , label: 'REFERENCE ACTION'
  , longer_alt: FOOTER_TOKEN
  , start_chars_hint: Array.from(
      new Set(
        (config.referenceActions || REFERENCE_ACTIONS).map((action) => {
          return action[0]
        }).filter(Boolean)
      )
    )
  , line_breaks: false
  })

  // Create custom issue prefix token with configuration
  const ISSUE_PREFIX = createToken({
    name: 'ISSUE_PREFIX'
  , pattern: createIssuePrefixMatcher(config)
  , label: 'ISSUE PREFIX'
    // Performance optimization hint
  , start_chars_hint: Array.from(
      new Set(
        (config.issuePrefix || ISSUE_PREFIXES).map((prefix) => {
          return prefix[0]
        }).filter(Boolean)
      )
    )
  , line_breaks: false
  })

  // Return object with tokens - ORDER MATTERS!
  // V8 maintains insertion order for object properties
  return {
    BLANK_LINE
  , NEW_LINE
  , WHITE_SPACE
  , LPAREN
  , RPAREN
  , BANG
  , COLON
  , COMMA
  , BREAKING_CHANGE_TOKEN // Custom configurable token (most specific first)
  , REFERENCE_ACTION_TOKEN // Reference actions like Fixes, Resolves (prioritized over general footers)
  , FOOTER_TOKEN // Footer token (before TEXT due to lookahead)
  , AT
  , SLASH
  , ISSUE_PREFIX // Custom configurable issue prefix token
  , IDENTIFIER
  , LINE_TEXT // More permissive text for opaque content (before TEXT)
  , TEXT // Structured text token (least specific, matches last)
  }
}

// ============================================
// Section-Specific Token Filtering
// ============================================

/**
 * Token names excluded from header parsing
 * These tokens are only valid in footer context
 */
const HEADER_EXCLUDED_TOKENS = new Set([
  'BREAKING_CHANGE_TOKEN' // Not used in header (only in footers)
, 'REFERENCE_ACTION_TOKEN' // Reference actions only valid in footer context
, 'at'
, 'slash'
, 'identifier'
, 'LINE_TEXT' // Would match structural tokens like "feat!:" incorrectly
, 'ISSUE_PREFIX' // Issue references only parsed in footers
, 'IDENTIFIER' // Issue references only parsed in footers
])

/**
 * Token names allowed in body parsing
 * Body is opaque content with minimal structure
 */
const BODY_TOKEN_NAMES = new Set([
  'BLANK_LINE'
, 'NEW_LINE'
, 'WHITE_SPACE'
, 'LINE_TEXT' // Permissive text token (allows ()!: characters)
])

/**
 * Get tokens for header parsing (excludes footer-specific tokens)
 * @param {Array} vocabulary - Full token vocabulary
 * @returns {Array} Filtered array of token instances for header parsing
 */
function getHeaderTokens(vocabulary) {
  return vocabulary.filter((token) => {
    return !HEADER_EXCLUDED_TOKENS.has(token.name)
  })
}

/**
 * Get tokens for body parsing (only structural + permissive text tokens)
 * @param {Array} vocabulary - Full token vocabulary
 * @returns {Array} Filtered array of token instances for body parsing
 */
function getBodyTokens(vocabulary) {
  return vocabulary.filter((token) => {
    return BODY_TOKEN_NAMES.has(token.name)
  })
}

/**
 * Get tokens for footer parsing (all tokens allowed)
 * @param {Array} vocabulary - Full token vocabulary
 * @returns {Array} Complete token vocabulary for footer parsing
 */
function getFooterTokens(vocabulary) {
  return vocabulary
}

module.exports = {
  // Pattern matcher functions
  createBreakingChangeMatcher
, createIssuePrefixMatcher

  // Vocabulary creation
, createTokenVocabulary

  // Section-specific token filtering
, getHeaderTokens
, getBodyTokens
, getFooterTokens

  // Base token instances (for testing/reference)
, BLANK_LINE
, NEW_LINE
, WHITE_SPACE
, LPAREN
, RPAREN
, BANG
, COLON
, COMMA
, AT
, SLASH
, TEXT
, LINE_TEXT
, FOOTER_TOKEN
, IDENTIFIER
}
