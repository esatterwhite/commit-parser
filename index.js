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
  // pre-chunk + parse approach for better context awareness
  return CommitParser.parse(commit_message, {
    notesPhrase: ['BREAKING CHANGE'] // Default phrases
  , ...options
  })
}

