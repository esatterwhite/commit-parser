'use strict'

/**
 * @module lib/tokens
 * @description Token definitions for the conventional commit parser using Chevrotain
 */

const {createToken, Lexer} = require('chevrotain')

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
// Token Definitions
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

// Footer tokens - simplified for pre-chunking approach
const FOOTER_TOKEN = createToken({
  name: 'FOOTER_TOKEN'
, pattern: /[A-Za-z]+([-][A-Za-z]+)*(?=[ \t]*:)/
})

const BREAKING_CHANGE_TOKEN = createToken({
  name: 'BREAKING_CHANGE_TOKEN'
, pattern: /BREAKING[- ]CHANGE/
, longer_alt: FOOTER_TOKEN
})

const IDENTIFIER = createToken({
  name: 'identifier'
, pattern: /[\w-]+/
})

// Collect all unique tokens for the parser
// ORDER MATTERS! More specific tokens must come before generic ones
const all_tokens = {
  BLANK_LINE
, NEW_LINE
, WHITE_SPACE
, LPAREN
, RPAREN
, BANG
, COLON
, COMMA
, BREAKING_CHANGE_TOKEN // Most specific
, FOOTER_TOKEN // More specific
, IDENTIFIER
, AT
, SLASH
, LINE_TEXT // More permissive text (before TEXT)
, TEXT // Structured text (least specific, matches last)
}

Object.defineProperties(all_tokens, {
  createBreakingChangeMatcher: {
    value: createBreakingChangeMatcher
  , enumerable: false
  , configurable: false
  }
, createIssuePrefixMatcher: {
    value: createIssuePrefixMatcher
  , enumberable: false
  , configurable: true
  }
})

module.exports = all_tokens
