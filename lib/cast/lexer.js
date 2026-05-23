'use strict'

/**
 * @module lib/lexer
 * @description Lexer for the conventional commit parser with simplified token approach
 */

const {Lexer} = require('chevrotain')
const tokens = require('./tokens.js')

const {
  BLANK_LINE
, NEW_LINE
, WHITE_SPACE
, LPAREN
, RPAREN
, BANG
, COLON
, TEXT
, BREAKING_CHANGE_TOKEN
, FOOTER_TOKEN
} = tokens

// ============================================
// Simplified Lexer Definition
// ============================================

// Use all tokens in a single mode for simplified parsing
// Order matters: more specific tokens first
const all_tokens = [
  // Structural tokens (highest priority)
  BLANK_LINE
, NEW_LINE
, WHITE_SPACE
, LPAREN
, RPAREN
, BANG
, COLON

  // Footer tokens (before generic text to catch footer patterns)
, BREAKING_CHANGE_TOKEN
, FOOTER_TOKEN

  // Content tokens (most general, should be last)
, TEXT
]

// ============================================
// Lexer Instance
// ============================================
const ConventionalCommitLexer = new Lexer(all_tokens)

module.exports = ConventionalCommitLexer

