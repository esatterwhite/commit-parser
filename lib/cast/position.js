'use strict'

/**
 * @module lib/cast/position
 * @description Position utilities for creating unist position objects
 */

/**
 * Convert Chevrotain token position to unist position
 * @param {object} token - Chevrotain token with startLine, startColumn, etc.
 * @returns {object|undefined} Unist position object
 */
function tokenToPosition(token) {
  if (!token) return undefined

  return {
    start: {
      line: token.startLine || 1
    , column: token.startColumn || 1
    , offset: token.startOffset || 0
    }
  , end: {
      line: token.endLine || token.startLine || 1
    , column: (token.endColumn || token.startColumn || 1) + 1 // Convert to exclusive end
    , offset: (token.endOffset || token.startOffset || 0) + 1
    }
  }
}

/**
 * Convert array of Chevrotain tokens to position spanning first to last
 * @param {Array} tokens - Array of Chevrotain tokens
 * @returns {object|undefined} Unist position object spanning all tokens
 */
function tokensToPosition(tokens) {
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

/**
 * Create position spanning from first to last child
 * @param {Array} children - Array of child nodes with position
 * @returns {object|undefined} Combined position object
 */
function spanPosition(children) {
  if (!children || children.length === 0) return undefined

  const first = children.find((child) => { return child.position })
  const last = children.slice().reverse().find((child) => { return child.position })

  if (!first || !last) return undefined

  return {
    start: first.position.start
  , end: last.position.end
  }
}

module.exports = {
  tokenToPosition
, tokensToPosition
, spanPosition
}
