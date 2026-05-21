'use strict'

const CommitParser = require('./lib/parse-chunks.js')

module.exports = {
  parse: parse
}

/**
 * Parse a conventional commit message into a CAST AST
 * @param {string} commit_message - The commit message to parse
 * @param {object} options - Parsing options
 * @param {string[]} options.notesPhrase - Array of breaking change phrases (default: ['BREAKING CHANGE'])
 * @returns {object} Parsed commit data as CAST AST
 */
function parse(commit_message, options = {}) {
  // Merge with defaults
  const config = {
    notesPhrase: ['BREAKING CHANGE'] // Default phrases
  , ...options
  }

  // Use the new pre-chunking approach to avoid "Redundant input, expecting EOF" errors
  return CommitParser.parse(commit_message, config)
}

