'use strict'

/**
 * @module lib/tokens
 * @description Token definitions for the conventional commit parser using Chevrotain
 */

const {createToken} = require('chevrotain')

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

// Generic text token (for structured content - type, scope, descriptions, footer values)
// This must be defined before tokens that use it as longer_alt
const TEXT = createToken({
  name: 'TEXT'
, pattern: /[^\s()!:\n]+/
})

// Body text token - more permissive for free-form body content
// Matches any non-whitespace characters including ()!: which are excluded from TEXT
// This allows body content to be truly free-form per conventional commits spec
// Note: No longer_alt since BODY_TEXT is used in a separate lexer mode without TEXT
const BODY_TEXT = createToken({
  name: 'BODY_TEXT'
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

const HASH = createToken({
  name: 'HASH'
, pattern: /#/
, label: '#'
})

// Issue reference tokens for parsing issue references in body and trailer values
// Note: No longer_alt for body context, but will be added for header/footer contexts
const ISSUE_PREFIX = createToken({
  name: 'ISSUE_PREFIX'
, pattern: /#(?=\d)|GH-(?=\d)|gh-(?=\d)/
, label: 'issue prefix'
})

const ISSUE_NUMBER = createToken({
  name: 'ISSUE_NUMBER'
, pattern: /\d+/
, label: 'issue number'
})

// Collect all unique tokens for the parser
// ORDER MATTERS! More specific tokens must come before generic ones
const all_tokens = [
  BLANK_LINE
, NEW_LINE
, WHITE_SPACE
, LPAREN
, RPAREN
, BANG
, COLON
, BREAKING_CHANGE_TOKEN // Most specific
, FOOTER_TOKEN // More specific
, ISSUE_PREFIX // Specific pattern for issue references
, ISSUE_NUMBER // Number pattern
, HASH // Single hash
, BODY_TEXT // More permissive text (before TEXT)
, TEXT // Generic text (least specific, matches last)
]

module.exports = Object.assign(all_tokens, {
  BLANK_LINE
, NEW_LINE
, WHITE_SPACE
, LPAREN
, RPAREN
, BANG
, COLON
, TEXT
, BODY_TEXT
, BREAKING_CHANGE_TOKEN
, FOOTER_TOKEN
, HASH
, ISSUE_PREFIX
, ISSUE_NUMBER
, createBreakingChangeMatcher
})

