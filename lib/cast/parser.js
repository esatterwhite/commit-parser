'use strict'

/**
 * @module lib/parser
 * @description Parser for conventional commit messages using Chevrotain
 */

const {CstParser, createToken} = require('chevrotain')
const {BREAKING_CHANGES, ISSUE_PREFIXES} = require('../constants.js')

const {
  BLANK_LINE
, NEW_LINE
, WHITE_SPACE
, LPAREN
, RPAREN
, BANG
, COLON
, COMMA
, TEXT
, LINE_TEXT
, FOOTER_TOKEN
, IDENTIFIER
, AT
, SLASH
, createBreakingChangeMatcher
, createIssuePrefixMatcher
} = require('./tokens.js')

// ============================================
// Configurable Token Creation
// ============================================

/**
 * Creates token set with configurable breaking change and issue prefix tokens
 * @param {object} config - Configuration with notesPhrase and issuePrefix arrays
 * @returns {object} Token set including custom configurable tokens
 */
function createConfigurableTokens(config = {
  notesPhrase: BREAKING_CHANGES
, issuePrefix: ISSUE_PREFIXES
}) {
  // Create custom breaking change token with configuration
  const BREAKING_CHANGE_TOKEN = createToken({
    name: 'BREAKING_CHANGE_TOKEN'
  , pattern: createBreakingChangeMatcher(config)
  , label: 'BREAKING CHANGE'
    // Performance optimization hint
  , start_chars_hint: Array.from(
      new Set(
        config.notesPhrase.map((phrase) => {
          return phrase[0]
        }).filter(Boolean)
      )
    )
  , line_breaks: false
  })

  // Create custom issue prefix token with configuration
  const ISSUE_PREFIX = createToken({
    name: 'ISSUE_PREFIX'
  , pattern: createIssuePrefixMatcher(config)
  , label: 'ISSUE PREFIX'
    // Performance optimization hint
  , start_chars_hint: Array.from(
      new Set(
        (config.issuePrefix || ISSUE_PREFIXES).map((prefix) => {
          return prefix[0]
        }).filter(Boolean)
      )
    )
  , line_breaks: false
  })

  // Return all tokens with the custom ones - ORDER MATTERS!
  return [
    BLANK_LINE
  , NEW_LINE
  , WHITE_SPACE
  , LPAREN
  , RPAREN
  , BANG
  , COLON
  , COMMA
  , BREAKING_CHANGE_TOKEN // Custom configurable token (most specific first)
  , FOOTER_TOKEN // Footer token (before TEXT due to lookahead)
  , AT
  , SLASH
  , ISSUE_PREFIX // Custom configurable issue prefix token
  , IDENTIFIER
  , LINE_TEXT // More permissive text for opaque content (before TEXT)
  , TEXT // Structured text token (least specific, matches last)
  ]
}

// ============================================
// Parser Definition
// ============================================

/**
 * Parser for conventional commit messages
 * @class ConventionalCommitParser
 * @extends CstParser
 * @param {Object} config - Configuration for token generation
 * @param {Array} [tokens] - Optional custom token array (overrides config-based generation)
 */
class ConventionalCommitParser extends CstParser {
  constructor(
    config = {notesPhrase: BREAKING_CHANGES, issuePrefix: ISSUE_PREFIXES}
  , tokens
  ) {
    // Use provided tokens or create tokens with configuration
    const token_set = tokens || createConfigurableTokens(config)
    super(token_set)

    // Extract token references from the vocabulary
    // These must be the same instances as in the vocabulary

    const {BREAKING_CHANGE_TOKEN, ISSUE_PREFIX} = token_set.reduce((acc, token) => {
      if (token.name === 'BREAKING_CHANGE_TOKEN') acc.BREAKING_CHANGE_TOKEN = token
      if (token.name === 'ISSUE_PREFIX') acc.ISSUE_PREFIX = token
      return acc
    }, {})

    // Main rule: a commit message consists of a header, optional body, and optional footers
    // Supports parametrized parsing to parse individual sections
    // @param {string} section - Optional section to parse: 'header', 'body', 'footer', or undefined for full commit
    this.RULE('commit', (section) => {
      this.OR([
        {
          GATE: () => {
            return section === 'header'
          }
        , ALT: () => {
            this.SUBRULE(this.header)
          }}
      , {
          GATE: () => {
            return section === 'body'
          }
        , ALT: () => {
            this.SUBRULE(this.body)
          }
        }
      , {
          GATE: () => {
            return section === 'footer'
          }
        , ALT: () => {
            this.SUBRULE(this.trailers)
          }
        }
      , {
          // Default case: parse full commit message
          GATE: () => {
            return !section
          }
        , ALT: () => {
            this.SUBRULE2(this.header)
            this.OPTION(() => {
              this.CONSUME(BLANK_LINE)
              this.SUBRULE2(this.body)
            })
            this.OPTION2(() => {
              this.CONSUME2(BLANK_LINE)
              this.SUBRULE2(this.trailers)
            })
          }
        }
      ])
    })

    // Header: either conventional format (type[scope][!]: description) or just description
    this.RULE('header', () => {
      this.OR([
        { // Look ahead to see if there's a colon pattern that indicates conventional format
          GATE: this.hasColonAfterType.bind(this)
        , ALT: () => {
            this.SUBRULE(this.conventionalHeader)
          }
        }
      , {
          // Alternative 2: Just description (non-conventional)
          ALT: () => {
            this.SUBRULE(this.description)
          }
        }
      ])
      this.OPTION(() => {
        this.CONSUME(NEW_LINE)
      })
    })

    // Conventional header: type[scope][!]: description
    this.RULE('conventionalHeader', () => {
      this.SUBRULE(this.type)
      this.OPTION(() => {
        this.SUBRULE(this.scope)
      })
      this.OPTION2(() => {
        this.CONSUME(BANG)
      })
      this.CONSUME(COLON)
      this.SUBRULE(this.description)
    })

    // Type: text or footer token (since footer tokens can match type names)
    this.RULE('type', () => {
      this.OR([
        {ALT: () => {
          return this.CONSUME(TEXT)
        }}
      , {ALT: () => {
          return this.CONSUME(FOOTER_TOKEN)
        }}
      ])
    })

    // Scope: (scope-text) - can contain multiple words
    this.RULE('scope', () => {
      this.CONSUME(LPAREN)
      this.AT_LEAST_ONE(() => {
        this.CONSUME(TEXT)
      })
      this.CONSUME(RPAREN)
    })

    // Description: opaque text after the colon (not parsed for structure)
    // Use TEXT for header context (LINE_TEXT is filtered out in header lexer)
    this.RULE('description', () => {
      this.AT_LEAST_ONE(() => {
        this.CONSUME(TEXT)
      })
    })

    // Body: simplified for pre-chunked content (no footer token conflicts)
    this.RULE('body', () => {
      this.MANY(() => {
        this.OR([
          {ALT: () => {
            return this.SUBRULE(this.bodyLine)
          }}
        , {ALT: () => {
            return this.CONSUME(BLANK_LINE)
          }}
        ])
      })
    })

    this.RULE('bodyLine', () => {
      // Body is free-form per conventional commits spec - treat as opaque blob
      // Use LINE_TEXT for opaque content (not parsed for structure)
      // A body line can be: text content or just a newline (empty line)
      this.OR([
        // Non-empty line: has content (text)
        {ALT: () => {
          this.AT_LEAST_ONE(() => {
            this.CONSUME(LINE_TEXT)
          })
          this.OPTION(() => {
            this.CONSUME(NEW_LINE)
          })
        }}
        // Empty line: just a newline
      , {ALT: () => {
          this.CONSUME2(NEW_LINE)
        }}
      ])
    })

    this.RULE('mention', () => {
      this.CONSUME(AT)
      this.CONSUME(IDENTIFIER)
    })

    this.RULE('issuererence', () => {
      this.OR([
        {ALT: () => {
          return this.SUBRULE(this.localreference)
        }}
      , {ALT: () => {
          return this.SUBRULE(this.remotereference)
        }}
      ])
    })

    // Issue reference: prefix + alphanumeric id (e.g., #123, GH-456, JIRA-ABC123)
    this.RULE('localreference', () => {
      this.CONSUME(ISSUE_PREFIX)
      this.CONSUME(IDENTIFIER)
    })

    // Issue reference from a different repo (esatterwhite/skyring#1)
    this.RULE('remotereference', () => {
      this.CONSUME(IDENTIFIER)
      this.CONSUME(SLASH)
      this.CONSUME2(IDENTIFIER)
      this.CONSUME(ISSUE_PREFIX)
      this.CONSUME3(IDENTIFIER)
    })

    // Trailers: one or more git trailer entries
    this.RULE('trailers', () => {
      this.AT_LEAST_ONE(() => {
        this.SUBRULE(this.trailer)
      })
    })

    // Trailer key: BREAKING_CHANGE_TOKEN or FOOTER_TOKEN
    this.RULE('trailerkey', () => {
      this.OR([
        {ALT: () => {
          return this.CONSUME(BREAKING_CHANGE_TOKEN)
        }}
      , {ALT: () => {
          return this.CONSUME(FOOTER_TOKEN)
        }}
      ])
    })

    // Trailer: key: value (git trailer format)
    this.RULE('trailer', () => {
      this.SUBRULE(this.trailerkey)
      this.CONSUME(COLON)
      this.SUBRULE(this.trailervalue)
    })

    // Trailer value: one or more lines of content
    this.RULE('trailervalue', () => {
      this.AT_LEAST_ONE(() => {
        this.SUBRULE(this.trailervalueline)
      })
    })

    // Issue references: #1, #2, #3
    // Whitespace and commas are automatically skipped by lexer
    this.RULE('issues', () => {
      // First issue reference
      this.SUBRULE(this.issuererence)

      // Additional references (whitespace/commas auto-skipped)
      this.MANY({
        MAX_LOOKAHEAD: 4
      , GATE: () => {
          // Check for issue prefix
          const pos = 1

          // Check for issue prefix
          if (this.LA(pos).tokenType === ISSUE_PREFIX) return true

          // Check for remote reference
          const org = this.LA(pos)
          const sep = this.LA(pos + 1)
          const repo = this.LA(pos + 2)
          const prefix = this.LA(pos + 3)

          if (
            org.tokenType === IDENTIFIER
              && sep.tokenType === SLASH
              && repo.tokenType === IDENTIFIER
              && prefix.tokenType === ISSUE_PREFIX
          ) return true

          return false
        }
      , DEF: () => {
          this.SUBRULE2(this.issuererence)
        }
      })
    })

    // Mixed content: text and #100 more text
    // Handles trailer values that mix text with issue references
    // Commas and whitespace are automatically skipped by lexer
    this.RULE('mixedcontent', () => {
      this.AT_LEAST_ONE(() => {
        this.OR([
          {ALT: () => {
            return this.SUBRULE(this.issuererence)
          }}
        , {ALT: () => {
            return this.SUBRULE(this.mention)
          }}
        , {ALT: () => {
            return this.CONSUME(LINE_TEXT)
          }}
        , {ALT: () => {
            return this.CONSUME(IDENTIFIER)
          }}
        ])
      })
    })

    // Trailer value line: either issue references or mixed content
    // Uses GATE to try issue pattern first, then falls back to mixed content
    this.RULE('trailervalueline', () => {
      this.OR([
        {
          GATE: () => {
            return this.LA(1).tokenType === ISSUE_PREFIX
          }
        , ALT: () => {
            this.SUBRULE(this.issues)
          }
        }
      , {
          ALT: () => {
            this.SUBRULE(this.mixedcontent)
          }
        }
      ])
      this.OPTION(() => {
        this.CONSUME(NEW_LINE)
      })
    })

    this.performSelfAnalysis()
  }

  /**
   * Look ahead to determine if there's a colon pattern after the type
   * This helps distinguish conventional commits from simple descriptions
   * @returns {boolean} true if conventional commit pattern is detected
   */
  hasColonAfterType() {
    let pos = 1

    // Look for pattern: (TEXT|FOOTER_TOKEN) [LPAREN TEXT RPAREN] [BANG] COLON
    // FOOTER_TOKEN is included because the lexer matches words like "feat" as FOOTER_TOKEN
    // when they're followed by a colon (due to the FOOTER_TOKEN pattern lookahead)
    if (this.LA(pos).tokenType !== TEXT && this.LA(pos).tokenType !== FOOTER_TOKEN) {
      return false
    }
    pos++

    // Skip optional scope: (scope) - can contain multiple TEXT tokens
    // Whitespace is automatically skipped by lexer
    if (this.LA(pos).tokenType === LPAREN) {
      pos++
      // Skip all TEXT tokens inside the scope
      while (this.LA(pos).tokenType === TEXT) {
        pos++
      }
      if (this.LA(pos).tokenType !== RPAREN) return false
      pos++
    }

    // Skip optional breaking change marker: !
    if (this.LA(pos).tokenType === BANG) pos++

    // Check for required colon
    return this.LA(pos).tokenType === COLON
  }
}

module.exports = {
  ConventionalCommitParser
, createConfigurableTokens
}

