'use strict'

/**
 * @module lib/tokens
 * @description Centralized token management for the conventional commit parser
 * Provides token definitions, configuration, and section-specific filtering
 */

const {createToken, Lexer} = require('chevrotain')
const {BREAKING_CHANGES, ISSUE_PREFIXES, REFERENCE_ACTIONS} = require('../constants.js')

/**
 * Creates a RegExp pattern for configurable breaking change phrases
 * @param {object} config - Configuration with notesPhrase array
 * @returns {RegExp} Regular expression for matching breaking change phrases
 */
function createBreakingChangeMatcher(config) {
  const patterns = config.notesPhrase.map((phrase) => {
    return phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  })

  patterns.sort((a, b) => {
    return b.length - a.length
  })

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
  return new RegExp(`(${combined_pattern})(?=[ \t]*:)`, 'i')
}

/**
 * Creates a RegExp pattern for configurable repository prefixes (identifier + issue prefix)
 * @param {object} config - Configuration with issuePrefix array
 * @returns {RegExp} Regular expression for matching repo prefixes without whitespace
 */
function createRepoPrefixMatcher(config) {
  const prefixes = config.issuePrefix || ISSUE_PREFIXES
  const prefix_patterns = prefixes.map((p) => {
    return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  })
  const combined_prefixes = prefix_patterns.join('|')
  const matcher = new RegExp(`(?<identifier>[\\w-]+)(?<prefix>${combined_prefixes})`, 'y')

  // Match identifier immediately followed by one of the issue prefixes (no whitespace)
  return function prefixMatch(text, start_offset) {
    matcher.lastIndex = start_offset

    const result = matcher.exec(text)
    if (!result) return null

    result.payload = result.groups
    return result
  }
}

/**
 * Creates a RegExp pattern for configurable issue prefixes
 * @param {object} config - Configuration with issuePrefix array
 * @returns {RegExp} Regular expression for matching issue prefixes with lookahead for alphanumeric
 */
function createIssuePrefixMatcher(config) {
  const prefixes = config.issuePrefix || ISSUE_PREFIXES

  const patterns = prefixes.map((prefix) => {
    return prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  })

  patterns.sort((a, b) => {
    return b.length - a.length
  })

  const combined_pattern = patterns.join('|')
  return new RegExp(`(${combined_pattern})(?=[A-Za-z0-9])`)
}

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

const TEXT = createToken({
  name: 'TEXT'
, pattern: /[^\s()!:\n]+/
})

const LINE_TEXT = createToken({
  name: 'LINE_TEXT'
, pattern: /[^\s\n]+/
})

const FOOTER_TOKEN = createToken({
  name: 'FOOTER_TOKEN'
, pattern: /[A-Za-z]+([-][A-Za-z]+)*(?=[ \t]*:)/
})

const IDENTIFIER = createToken({
  name: 'identifier'
, pattern: /[\w-]+/
})

function createTokenVocabulary(config = {
  notesPhrase: BREAKING_CHANGES
, issuePrefix: ISSUE_PREFIXES
, referenceActions: REFERENCE_ACTIONS
}) {
  const BREAKING_CHANGE = createToken({
    name: 'BREAKING_CHANGE'
  , pattern: createBreakingChangeMatcher(config)
  , label: 'BREAKING CHANGE'
  , longer_alt: FOOTER_TOKEN
  , start_chars_hint: Array.from(
      new Set(config.notesPhrase.map((phrase) => {
        return phrase[0]
      }).filter(Boolean))
    )
  , line_breaks: false
  })

  const REFERENCE_ACTION = createToken({
    name: 'REFERENCE_ACTION'
  , pattern: createReferenceActionMatcher(config)
  , label: 'REFERENCE ACTION'
  , longer_alt: FOOTER_TOKEN
  , start_chars_hint: Array.from(
      new Set((config.referenceActions || REFERENCE_ACTIONS).map((action) => {
        return action[0]
      }).filter(Boolean))
    )
  , line_breaks: false
  })

  const REPO_AND_PREFIX = createToken({
    name: 'REPO_AND_PREFIX'
  , pattern: createRepoPrefixMatcher(config)
  , label: 'ISSUE PREFIX'
  , line_breaks: false
  })

  const ISSUE_PREFIX = createToken({
    name: 'ISSUE_PREFIX'
  , pattern: createIssuePrefixMatcher(config)
  , label: 'ISSUE PREFIX'
  , start_chars_hint: Array.from(
      new Set((config.issuePrefix || ISSUE_PREFIXES)
        .map((prefix) => {
          return prefix[0]
        }).filter(Boolean))
    )
  , line_breaks: false
  })

  return {
    BLANK_LINE
  , NEW_LINE
  , WHITE_SPACE
  , LPAREN
  , RPAREN
  , BANG
  , COLON
  , COMMA
  , BREAKING_CHANGE
  , REFERENCE_ACTION
  , REPO_AND_PREFIX // Must come before ISSUE_PREFIX and IDENTIFIER
  , FOOTER_TOKEN
  , AT
  , SLASH
  , ISSUE_PREFIX
  , IDENTIFIER
  , LINE_TEXT
  , TEXT
  }
}

const HEADER_EXCLUDED_TOKENS = new Set([
  'BREAKING_CHANGE'
, 'REFERENCE_ACTION'
, 'at'
, 'slash'
, 'identifier'
, 'LINE_TEXT'
, 'ISSUE_PREFIX'
, 'IDENTIFIER'
])

const BODY_TOKEN_NAMES = new Set([
  'BLANK_LINE'
, 'NEW_LINE'
, 'WHITE_SPACE'
, 'LINE_TEXT'
])

function getHeaderTokens(vocabulary) {
  return vocabulary.filter((token) => {
    return !HEADER_EXCLUDED_TOKENS.has(token.name)
  })
}

function getBodyTokens(vocabulary) {
  return vocabulary.filter((token) => {
    return BODY_TOKEN_NAMES.has(token.name)
  })
}

function getFooterTokens(vocabulary) {
  return vocabulary
}

module.exports = {
  createBreakingChangeMatcher
, createIssuePrefixMatcher
, createTokenVocabulary
, getHeaderTokens
, getBodyTokens
, getFooterTokens
, BLANK_LINE
, NEW_LINE
, WHITE_SPACE
, LPAREN
, RPAREN
, BANG
, COLON
, AT
, SLASH
, TEXT
, LINE_TEXT
, FOOTER_TOKEN
, IDENTIFIER
}
