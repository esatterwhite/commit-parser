'use strict'

/**
 * @module lib/visitor
 * @description Visitor for transforming CST to CAST AST representation
 */

const {ConventionalCommitParser} = require('./parser.js')
const {tokenToPosition, tokensToPosition} = require('./cast/position.js')
const node = require('./cast/node/index.js')
const typecast = require('./lang/string/typecast.js')

// Create a temporary parser instance to get the base visitor
const temp_parser = new ConventionalCommitParser()
const BaseCstVisitor = temp_parser.getBaseCstVisitorConstructor()

/**
 * Visitor class for converting CST to CAST AST
 * @class ConventionalCommitVisitor
 * @extends BaseCstVisitor
 */
class ConventionalCommitVisitor extends BaseCstVisitor {
  constructor() {
    super()
    this.validateVisitor()
  }

  commit(ctx) {
    const children = []
    let breaking = false

    // Visit header
    const header = this.visit(ctx.header)
    children.push(header)

    // Check if header has a description with breaking: true
    breaking = header.children.some((child) => {
      return child.type === 'description' && child.breaking
    })

    // Visit body if present
    if (ctx.body) {
      const body = this.visit(ctx.body)
      children.push(body)
    }

    // Visit trailers if present
    if (ctx.trailers) {
      const footer = this.visit(ctx.trailers)
      children.push(footer)

      // Check for breaking change trailers
      if (!breaking) {
        breaking = footer.children.some((child) => {
          return child.breaking
        })
      }
    }
    return node.root({breaking: breaking}, children)
  }

  header(ctx) {
    // Header now has two alternatives: conventionalHeader or description
    if (ctx.conventionalHeader) return this.visit(ctx.conventionalHeader[0])

    // Non-conventional commit: just description
    if (ctx.description) return node.header({}, [this.visit(ctx.description[0])])

    // empty header
    return node.header({}, [])
  }

  conventionalHeader(ctx) {
    const children = []

    // Track if this is a breaking change (BANG present)
    const has_breaking = !!ctx.BANG

    // Add type node
    if (ctx.type) {
      const type_node = this.visit(ctx.type[0])
      children.push(type_node)
    }

    // Add scope node with parentheses if present
    if (ctx.scope) {
      const scope_with_parens = this.visit(ctx.scope[0])
      // Add all children from the scope (parentheses and scope content)
      children.push(...scope_with_parens.children)
    }

    // Add breaking change indicator if present
    if (ctx.BANG) {
      const bang_token = ctx.BANG[0]
      const bang_node = node.bang({position: tokenToPosition(bang_token)})
      children.push(bang_node)
    }

    // Add colon
    if (ctx.COLON) {
      const colon_token = ctx.COLON[0]
      const text_node = node.text({value: ':', position: tokenToPosition(colon_token)})
      children.push(text_node)
    }

    // Add whitespace after colon if present
    if (ctx.WHITE_SPACE) {
      const ws_token = ctx.WHITE_SPACE[0]
      const text_node = node.text({value: ' ', position: tokenToPosition(ws_token)})
      children.push(text_node)
    }

    // Add description node with breaking flag
    if (ctx.description) {
      const description_node = this.visit(ctx.description[0], has_breaking)
      children.push(description_node)
    }

    return node.header({}, children)
  }

  type(ctx) {
    // Type can be either TEXT or FOOTER_TOKEN
    const token = ctx.TEXT ? ctx.TEXT[0] : ctx.FOOTER_TOKEN[0]
    return node.type({value: token.image, position: tokenToPosition(token)})
  }

  scope(ctx) {
    const children = []

    // Add opening parenthesis
    if (ctx.LPAREN) {
      children.push(
        node.text({
          value: toText(ctx.LPAREN)
        , position: tokenToPosition(ctx.LPAREN[0])
        })
      )
    }

    // Add scope content using helper functions
    const scope_tokens = collectTokens(ctx, ['TEXT', 'WHITE_SPACE'])
    if (scope_tokens.length) {
      const scope_value = toText(scope_tokens)
      const scope_position = tokensToPosition(scope_tokens)
      children.push(node.scope({value: scope_value, position: scope_position}))
    }

    // Add closing parenthesis
    if (ctx.RPAREN) {
      children.push(
        node.text({
          value: toText(ctx.RPAREN)
        , position: tokenToPosition(ctx.RPAREN[0])
        })
      )
    }

    // Return the scope node and parentheses as separate children to be added to header
    return {
      type: 'scope_with_parens'
    , children
    }
  }

  description(ctx, breaking = false) {
    // Use helper functions to collect and process tokens
    const all_tokens = collectTokens(ctx, ['TEXT', 'WHITE_SPACE'])
    if (!all_tokens.length) return node.description({breaking: breaking, value: ''}, [])

    const full_text = toText(all_tokens)
    const description_position = tokensToPosition(all_tokens)

    // Create a single text node for the description
    const text_node = node.text({value: full_text, position: description_position})

    return node.description({
      breaking: breaking
    , value: full_text
    , position: description_position
    }, [text_node])
  }

  body(ctx) {
    // Process both bodyLine nodes and BLANK_LINE tokens to preserve empty lines
    const body_lines = ctx.bodyLine || []
    const blank_lines = ctx.BLANK_LINE || []

    // Combine and sort by position to maintain order
    const all_items = []

    // Add bodyLine nodes
    for (const body_line of body_lines) {
      const line_node = this.visit(body_line)
      if (line_node) {
        all_items.push({
          type: 'line'
        , node: line_node
        , offset: line_node.position?.start?.offset || 0
        })
      }
    }

    // Add BLANK_LINE tokens as line nodes with empty text
    for (const blank_token of blank_lines) {

      // Create empty text node to represent blank line
      const text_node = node.text({value: '', position: tokenToPosition(blank_token)})
      all_items.push({
        type: 'blank'
      , node: node.line({
          position: tokenToPosition(blank_token)
        }, [text_node])
      , offset: blank_token.startOffset || 0
      })
    }

    // Sort by offset to maintain original order
    all_items.sort((a, b) => {
      return a.offset - b.offset
    })

    const line_nodes = []
    for (const item of all_items) {
      line_nodes.push(item.node)
    }

    return node.body({}, line_nodes)
  }

  bodyLine(ctx) {
    // Body is an opaque blob per the spec - no issue reference parsing
    // Collect LINE_TEXT and WHITE_SPACE tokens (not NEW_LINE - that's just a separator)
    const all_tokens = collectTokens(ctx, ['LINE_TEXT', 'WHITE_SPACE'])
    if (!all_tokens.length) return node.line({}, [])

    const full_text = toText(all_tokens)
    const line_position = tokensToPosition(all_tokens)

    // Create a single text node without parsing for issue references
    const text_node = node.text({value: full_text, position: line_position})

    return node.line({position: line_position}, [text_node])
  }

  issueReference(ctx) {
    // Parse issue references from CST (e.g., #123, GH-456, JIRA-ABC123)
    const prefix_token = ctx.ISSUE_PREFIX?.[0]
    const id_token = ctx.ISSUE_ID?.[0]

    if (!prefix_token || !id_token) return null

    const prefix = prefix_token.image
    const id_value = id_token.image
    const value = prefix + id_value

    // Calculate position spanning both tokens using helper function
    const position = tokensToPosition([prefix_token, id_token])

    return node.issueReference({
      value: value
    , prefix: prefix
    , id: typecast(id_value)
    , position: position
    })
  }

  trailers(ctx) {
    const trailers = ctx.trailer.map((trailer) => {
      return this.visit(trailer)
    })
    return node.footer({}, trailers)
  }

  trailerkey(ctx) {
    // Trailerkey just returns the token - used by trailer visitor
    // This method exists to satisfy Chevrotain's visitor validation
    if (ctx.BREAKING_CHANGE_TOKEN) {
      return {token: ctx.BREAKING_CHANGE_TOKEN[0], breaking: true}
    } else if (ctx.FOOTER_TOKEN) {
      return {token: ctx.FOOTER_TOKEN[0], breaking: false}
    }
    return null
  }

  trailer(ctx) {
    const children = []
    let breaking = false

    // Visit trailer key
    if (ctx.trailerkey) {
      const key_result = this.visit(ctx.trailerkey[0])
      if (key_result) {
        const text_node = node.text({
          value: key_result.token.image
        , position: tokenToPosition(key_result.token)
        })
        const key_node = node.trailerKey({}, [text_node])
        children.push(key_node)
        breaking = key_result.breaking
      }
    }

    // Add colon as text node
    if (ctx.COLON) {
      const colon_token = ctx.COLON[0]
      const text_node = node.text({
        value: ':'
      , position: tokenToPosition(colon_token)
      })
      children.push(text_node)
    }

    // Add whitespace after colon if present
    if (ctx.WHITE_SPACE) {
      const ws_token = ctx.WHITE_SPACE[0]
      const text_node = node.text({
        value: ' '
      , position: tokenToPosition(ws_token)
      })
      children.push(text_node)
    }

    // Create trailer value node
    const value_node = this.visit(ctx.trailervalue)
    children.push(value_node)

    return node.trailer({breaking: breaking}, children)
  }

  trailervalue(ctx) {
    // Collect all children from all lines
    const children = []

    for (const line of ctx.trailervalueline) {
      children.push(...this.visit(line))
    }

    return node.trailerValue({}, children)
  }

  trailervalueline(ctx) {
    // Trailer value line can be either issues or mixedcontent
    if (ctx.issues) {
      return this.visit(ctx.issues[0])
    } else if (ctx.mixedcontent) {
      return this.visit(ctx.mixedcontent[0])
    }
    return []
  }

  issues(ctx) {
    // Issues: only issue references, omit commas and whitespace (they're separators)
    const children = []

    if (ctx.issueReference) {
      for (const ref_ctx of ctx.issueReference) {
        const ref_node = this.visit(ref_ctx)
        if (ref_node) {
          children.push(ref_node)
        }
      }
    }

    return children
  }

  mixedcontent(ctx) {
    // Mixed content: text and issue references with commas included
    const items = []

    // Collect LINE_TEXT tokens
    if (ctx.LINE_TEXT) {
      for (const token of ctx.LINE_TEXT) {
        items.push({
          type: 'text_token'
        , token
        , offset: token.startOffset || 0
        })
      }
    }

    // Collect ISSUE_ID tokens
    if (ctx.ISSUE_ID) {
      for (const token of ctx.ISSUE_ID) {
        items.push({
          type: 'text_token'
        , token
        , offset: token.startOffset || 0
        })
      }
    }

    // Collect WHITE_SPACE tokens
    if (ctx.WHITE_SPACE) {
      for (const token of ctx.WHITE_SPACE) {
        items.push({
          type: 'whitespace_token'
        , token
        , offset: token.startOffset || 0
        })
      }
    }

    // Collect COMMA tokens
    if (ctx.COMMA) {
      for (const token of ctx.COMMA) {
        items.push({
          type: 'comma_token'
        , token
        , offset: token.startOffset || 0
        })
      }
    }

    // Collect issue references
    if (ctx.issueReference) {
      for (const ref_ctx of ctx.issueReference) {
        const ref_node = this.visit(ref_ctx)
        items.push({
          type: 'issueReference'
        , node: ref_node
        , offset: ref_node.position?.start?.offset || 0
        })
      }
    }

    // Sort by position to maintain order
    items.sort((a, b) => {
      return a.offset - b.offset
    })

    // Consolidate tokens into nodes
    const children = []
    let text_buffer = []
    let token_buffer = []

    for (const item of items) {
      switch (item.type) {
        case 'issueReference': {
        // Flush text buffer before adding issue reference
          const text_value = text_buffer.join('').trim()
          if (text_value.length) {
            const text_position = tokensToPosition(token_buffer)
            children.push(node.text({value: text_value, position: text_position}))
          }
          text_buffer = []
          token_buffer = []

          // Add issue reference
          children.push(item.node)
          break
        }
        case 'comma_token': {
          // Skip commas - they act as separators only and should not appear in output
          // Flush any existing text buffer before skipping the comma
          const text_value = text_buffer.join('').trim()

          if (text_value.length) {
            const text_position = tokensToPosition(token_buffer)
            children.push(node.text({value: text_value, position: text_position}))
          }
          text_buffer = []
          token_buffer = []
          break
        }
        default: {
          // Collect text and whitespace tokens into text buffer
          token_buffer.push(item.token)
          text_buffer.push(item.token.image)
        }
      }
    }

    // Flush any remaining text buffer
    const text_value = text_buffer.join('').trim()
    if (text_value.length) {
      const text_position = tokensToPosition(token_buffer)
      children.push(
        node.text({
          value: text_value, position: text_position
        })
      )
    }

    return children
  }
}

module.exports = ConventionalCommitVisitor

/**
 * Collect and sort tokens from context by type
 * @param {object} ctx - Context object with token arrays
 * @param {Array<string>} tokenTypes - Token type names to collect
 * @returns {Array} Sorted array of tokens
 */
function collectTokens(ctx, tokenTypes) {
  const tokens = []
  for (const tokenType of tokenTypes) {
    if (ctx[tokenType]) {
      tokens.push(...ctx[tokenType])
    }
  }
  // Sort by position to maintain order
  tokens.sort((a, b) => {
    return (a.startOffset || 0) - (b.startOffset || 0)
  })
  return tokens
}

/**
 * Reconstruct text from tokens
 * @param {Array} tokens - Array of tokens
 * @returns {string} Reconstructed text
 */
function toText(tokens) {
  return tokens.map((token) => {
    return token.image
  }).join('')
}

