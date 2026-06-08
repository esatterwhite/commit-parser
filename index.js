'use strict'

const CommitParser = require('./lib/commit-parser.js')
const cast = require('./lib/cast/index.js')

module.exports = {
/**
 * Parse a conventional commit message into a CAST AST
 * @param {string} msg - The commit message to parse
 * @param {object} options - Parsing options
 * @param {string[]} options.notesPhrase - Array of breaking change phrases (default: ['BREAKING CHANGE'])
 * @returns {object} Parsed commit data as CAST AST
 */
  parse: CommitParser.parse.bind(CommitParser)
, cast: cast
, CommitParser: CommitParser
}

