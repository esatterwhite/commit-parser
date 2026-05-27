'use strict'

module.exports = toString

/**
 * Converts tokens to normalized text by joining with single spaces
 * @param {Array} tokens - Array of tokens
 * @returns {string} Normalized text with single spaces between tokens
 */
function toString(tokens) {
  return tokens.map((token) => {
    return token.image
  }).join(' ')
}
