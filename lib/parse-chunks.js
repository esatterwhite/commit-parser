'use strict'

/**
 * @module lib/parse-chunks
 * @description Integrated parsing using pre-chunking and section-specific parsing
 */

const {Lexer} = require('chevrotain')
const node = require('./cast/node/index.js')
const {ConventionalCommitParser} = require('./cast/parser.js')
const ConventionalCommitVisitor = require('./cast/visitor.js')
const {PreParser, adjustTokenPositions} = require('./chunker.js')
const {BREAKING_CHANGES, ISSUE_PREFIXES} = require('./constants.js')
const {
  createTokenVocabulary
, getHeaderTokens
, getBodyTokens
, getFooterTokens
} = require('./cast/tokens.js')

/**
 * Map section names to their corresponding CST node names
 * Footer section produces 'trailers' node due to parser rule naming
 */
const NODES = {
  header: 'header'
, body: 'body'
, footer: 'trailers' // Parser rule produces 'trailers' node, not 'footer'
}

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
  } = {}) {

    if (preparser) this.preparser = preparser

    const config = {notesPhrase, issuePrefix}
    this.config = config
    const vocabulary = createTokenVocabulary(config)

    // Create parser with token vocabulary object (will convert to array internally)
    this.#parser = new ConventionalCommitParser(config, vocabulary)
    this.#visitor = new ConventionalCommitVisitor()
    this.#tokens = Object.values(vocabulary)
  }

  static parse(message, config) {
    const parser = new this(config)
    return parser.parse(message)
  }
  parse(message) {
    let breaking = false
    const chunks = PreParser.parse(message, this.config)
    const children = []
    const parsed_sections = {
      header: null
    , body: null
    , footer: null
    }

    // Parse each section individually
    parsed_sections.header = this.parseSection(chunks.header, 'header')
    parsed_sections.body = this.parseSection(chunks.body, 'body')
    parsed_sections.footer = this.parseSection(chunks.footer, 'footer')

    // Add sections if present
    if (parsed_sections.header) children.push(parsed_sections.header)
    if (parsed_sections.body) children.push(parsed_sections.body)
    if (parsed_sections.footer) children.push(parsed_sections.footer)

    // Check if header indicates breaking change (via description.breaking)
    breaking = breaking || parsed_sections.header?.children?.some?.((child) => {
      return child.type === 'description' && child.breaking
    })

    // Check for breaking change trailers
    breaking = breaking || parsed_sections.footer?.children?.some?.((child) => {
      return child.breaking
    })

    return node.root({breaking}, children)
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
    // Map section name to CST node name (footer → trailers)
    const node = NODES[section]

    // Visit the CST node directly (not the commit wrapper)
    const ast = this.#visitor.visit(cst.children?.[node]?.[0])

    return ast
  }
  /**
   * Get token names for a specific section by filtering the full token set
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
