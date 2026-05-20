'use strict'

const {parseCommitMessage} = require('./lib/parse-chunks.js')
const ConventionalCommitLexer = require('./lib/lexer.js')
const {ConventionalCommitParser} = require('./lib/parser.js')
const ConventionalCommitVisitor = require('./lib/visitor.js')

module.exports = {
  parse: parse
, ConventionalCommitLexer: ConventionalCommitLexer
, ConventionalCommitParser: ConventionalCommitParser
, ConventionalCommitVisitor: ConventionalCommitVisitor
, node: require('./lib/cast/node/index.js')
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
  return parseCommitMessage(commit_message, config)
}

