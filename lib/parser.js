'use strict'

/**
 * @module lib/parser
 * @description Parser for conventional commit messages using Chevrotain
 */

const {CstParser, createToken} = require('chevrotain')
const all_tokens = require('./tokens.js')
const {BREAKING_CHANGES} = require('./constants.js')

const {
  BLANK_LINE
, NEW_LINE
, WHITE_SPACE
, LPAREN
, RPAREN
, BANG
, COLON
, TEXT
, BODY_TEXT
, FOOTER_TOKEN
, ISSUE_PREFIX
, ISSUE_NUMBER
, createBreakingChangeMatcher
} = all_tokens

// ============================================
// Configurable Token Creation
// ============================================

/**
 * Creates token set with configurable breaking change token
 * @param {object} config - Configuration with notesPhrase array
 * @returns {object} Token set including custom breaking change token
 */
function createConfigurableTokens(config = {notesPhrase: BREAKING_CHANGES}) {
  // Create custom breaking change token with configuration
  const BREAKING_CHANGE_TOKEN = createToken({
    name: 'BREAKING_CHANGE_TOKEN'
  , pattern: createBreakingChangeMatcher(config)
  , label: 'BREAKING_CHANGE'
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

  // Return all tokens with the custom one - ORDER MATTERS!
  return [
    BLANK_LINE
  , NEW_LINE
  , WHITE_SPACE
  , LPAREN
  , RPAREN
  , BANG
  , COLON
  , BREAKING_CHANGE_TOKEN // Custom configurable token (most specific first)
  , FOOTER_TOKEN // Footer token (before TEXT due to lookahead)
  , ISSUE_PREFIX // Issue reference prefix (before TEXT to match patterns like #123)
  , ISSUE_NUMBER // Issue reference number
  , BODY_TEXT // More permissive text (before TEXT)
  , TEXT // Generic text token
  ]
}

// ============================================
// Parser Definition
// ============================================

/**
 * Parser for conventional commit messages
 * @class ConventionalCommitParser
 * @extends CstParser
 */
class ConventionalCommitParser extends CstParser {
  constructor(config = {notesPhrase: BREAKING_CHANGES}) {
    // Create tokens with configuration
    const configurableTokens = createConfigurableTokens(config)
    super(configurableTokens)

    this.config = config
    this.tokens = configurableTokens // Expose tokens for lexer consistency
    this.breakingChangeToken = configurableTokens.find((token) => {
      return token.name === 'BREAKING_CHANGE_TOKEN'
    })

    // Create a reference to the breaking change token for use in rules
    const BREAKING_CHANGE_TOKEN = this.breakingChangeToken

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
          }
        }
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
            this.SUBRULE(this.footers)
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
              this.SUBRULE2(this.footers)
            })
          }
        }
      ])
    })

    // Header: either conventional format (type[scope][!]: description) or just description
    this.RULE('header', () => {
      this.OR([
        {
          GATE: () => {
            // Look ahead to see if there's a colon pattern that indicates conventional format
            return this.hasColonAfterType()
          }
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
      this.OPTION3(() => {
        this.CONSUME(WHITE_SPACE)
      })
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
        this.OR([
          {ALT: () => {
            return this.CONSUME(TEXT)
          }}
        , {ALT: () => {
            return this.CONSUME(WHITE_SPACE)
          }}
        ])
      })
      this.CONSUME(RPAREN)
    })

    // Description: text after the colon (include whitespace for reconstruction)
    this.RULE('description', () => {
      this.AT_LEAST_ONE(() => {
        this.OR([
          {ALT: () => {
            return this.CONSUME(TEXT)
          }}
        , {ALT: () => {
            return this.CONSUME(WHITE_SPACE)
          }}
        ])
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
      // Use only BODY_TEXT (not TEXT) since body lexer only produces BODY_TEXT tokens
      // A body line can be: text content, whitespace, or just a newline (empty line)
      this.OR([
        {
          // Non-empty line: has content (text and/or whitespace)
          ALT: () => {
            this.AT_LEAST_ONE(() => {
              this.OR2([
                {ALT: () => {
                  return this.CONSUME(BODY_TEXT)
                }}
              , {ALT: () => {
                  return this.CONSUME(WHITE_SPACE)
                }}
              ])
            })
            this.OPTION(() => {
              this.CONSUME(NEW_LINE)
            })
          }
        }
      , {
          // Empty line: just a newline
          ALT: () => {
            this.CONSUME2(NEW_LINE)
          }
        }
      ])
    })

    // Issue reference: prefix + number (e.g., #123, GH-456)
    this.RULE('issueReference', () => {
      this.CONSUME(ISSUE_PREFIX)
      this.CONSUME(ISSUE_NUMBER)
    })

    // Footers: one or more footer entries
    this.RULE('footers', () => {
      this.AT_LEAST_ONE(() => {
        this.SUBRULE(this.footer)
      })
    })

    // Footer: token: value (git trailer format)
    this.RULE('footer', () => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(BREAKING_CHANGE_TOKEN)
            this.CONSUME(COLON)
          }
        }
      , {
          ALT: () => {
            this.CONSUME(FOOTER_TOKEN)
            this.CONSUME2(COLON)
          }
        }
      ])
      this.OPTION(() => {
        this.CONSUME(WHITE_SPACE)
      })
      this.SUBRULE(this.footerValue)
    })

    this.RULE('footerValue', () => {
      this.AT_LEAST_ONE(() => {
        this.SUBRULE(this.footerValueLine)
      })
    })

    this.RULE('footerValueLine', () => {
      // Include whitespace and issue references for text reconstruction
      this.AT_LEAST_ONE(() => {
        this.OR([
          {ALT: () => {
            return this.SUBRULE(this.issueReference)
          }}
        , {ALT: () => {
            return this.CONSUME(TEXT)
          }}
        , {ALT: () => {
            return this.CONSUME(WHITE_SPACE)
          }}
        ])
      })
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

    // Skip optional scope: (scope) - can contain multiple tokens
    if (this.LA(pos).tokenType === LPAREN) {
      pos++
      // Skip all TEXT and WHITE_SPACE tokens inside the scope
      while (this.LA(pos).tokenType === TEXT || this.LA(pos).tokenType === WHITE_SPACE) {
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

