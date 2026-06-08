'use strict'

/**
 * @module lib/parse-chunks
 * @description Integrated parsing using pre-chunking and section-specific parsing
 */

const {Lexer} = require('chevrotain')
const ConventionalCommitParser = require('./cast/parser.js')
const CASTVisitor = require('./cast/visitor/ast.js')
const {PreParser, adjustTokenPositions} = require('./chunker.js')
const {BREAKING_CHANGES, ISSUE_PREFIXES, REFERENCE_ACTIONS} = require('./constants.js')
const {
  createTokenVocabulary
, getHeaderTokens
, getBodyTokens
, getFooterTokens
} = require('./cast/tokens.js')

module.exports = class CommitParser {
  preparser = PreParser
  config = null
  #tokens = null
  #parser = null
  #visitor = null
  constructor({
    preparser = PreParser
  , notesPhrase = BREAKING_CHANGES
  , issuePrefix = ISSUE_PREFIXES
  , referenceActions = REFERENCE_ACTIONS
  , visitor = null
  } = {}) {

    if (preparser) this.preparser = preparser

    const config = {notesPhrase, issuePrefix, referenceActions}
    this.config = config
    const vocabulary = createTokenVocabulary(config)

    // Create parser with token vocabulary object (will convert to array internally)
    this.#parser = new ConventionalCommitParser(config, vocabulary)
    this.#visitor = visitor ? new visitor() : new CASTVisitor()
    this.#tokens = Object.values(vocabulary)
  }

  static parse(message, config) {
    const parser = new this(config)
    return parser.parse(message)
  }

  parse(message) {
    const chunks = PreParser.parse(message, this.config)
    const child = {}
    const cst = {
      name: 'commit'
    , children: child
    }

    const parsed_sections = {
      header: null
    , body: null
    , footer: null
    }

    // Parse each section individually
    parsed_sections.header = this.parseSection(chunks.header, 'header')
    parsed_sections.body = this.parseSection(chunks.body, 'body')
    parsed_sections.footer = this.parseSection(chunks.footer, 'footer')

    // combind sections into 1 tree
    if (parsed_sections.header) child.header = parsed_sections.header.children.header[0]
    if (parsed_sections.body) child.body = parsed_sections.body.children.body[0]
    if (parsed_sections.footer) child.footer = parsed_sections.footer.children.footer[0]

    // run visitor
    return this.#visitor.visit(cst, chunks)
  }

  parseSection(chunk, section) {
    // Get section-specific tokens using centralized token management
    if (!chunk) return null

    const section_tokens = this.tokensFor(this.#tokens, section)
    const lexer = new Lexer(section_tokens)
    const lexed = lexer.tokenize(chunk.content)

    // Parse section using parametrized commit rule
    this.#parser.input = adjustTokenPositions(lexed.tokens, chunk)
    const cst = this.#parser.commit(section)

    if (this.#parser.errors.length > 0) {
      const error_messages = this.#parser.errors.map((err) => {
        return err.message
      }).join('; ')
      throw new Error(`${section} parsing failed: ${error_messages}`)
    }

    return cst
  }
  /**
   * Get token names for a specific section by filtering the full token set
:12
   * @param {Array} full_tokens - Full array of token instances
   * @param {string} section - Section name ('header', 'body', or 'footer')
   * @returns {Array} Filtered array of token instances for the section
   */
  tokensFor(full_tokens, section) {
    switch (section) {
      case 'header': {
        return getHeaderTokens(full_tokens)
      }
      case 'body': {
        return getBodyTokens(full_tokens)
      }
      case 'footer': {
        return getFooterTokens(full_tokens)
      }
      default: {
        throw new Error(`Unknown section: ${section}`)
      }
    }
  }
}
