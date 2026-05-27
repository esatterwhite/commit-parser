'use strict'

module.exports = collectTokens

/**
 * Collect and sort tokens from context by type
 * @param {object} ctx - Context object with token arrays
 * @param {String} type - Token type names to collect
 * @returns {Array} Sorted array of tokens
 */
function collectTokens(ctx, types) {
  const tokens = []
  for (const type of types) {
    if (ctx[type]) {
      tokens.push(...ctx[type])
    }
  }
  // Sort by position to maintain order
  tokens.sort((a, b) => {
    return (a.startOffset || 0) - (b.startOffset || 0)
  })
  return tokens
}
