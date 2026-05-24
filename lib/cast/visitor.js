'use strict'

/**
 * @module lib/visitor
 * @description Visitor for transforming CST to CAST AST representation
 */

const {ConventionalCommitParser} = require('./parser.js')
const {tokenToPosition, tokensToPosition} = require('./position.js')
const node = require('./node/index.js')
const typecast = require('../lang/string/typecast.js')

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

    const has_breaking = !!ctx.BANG
    if (ctx.type) children.push(this.visit(ctx.type[0]))
    if (ctx.scope) children.push(this.visit(ctx.scope[0]))
    if (ctx.BANG) {
      const bang_token = ctx.BANG[0]
      const bang_node = node.bang({position: tokenToPosition(bang_token)})
      children.push(bang_node)
    }

    // Add description node with breaking flag
    if (ctx.description) children.push(this.visit(ctx.description[0], has_breaking))

    return node.header({}, children)
  }

  type(ctx) {
    // Type can be either TEXT or FOOTER_TOKEN
    const token = ctx.TEXT ? ctx.TEXT[0] : ctx.FOOTER_TOKEN[0]
    return node.type({value: token.image, position: tokenToPosition(token)})
  }

  scope(ctx) {
    // Add scope content using helper functions
    const scope_tokens = collectTokens(ctx, ['TEXT'])
    const scope_value = toNormalizedText(scope_tokens)
    const scope_position = tokensToPosition(scope_tokens)
    return node.scope({
      value: scope_value
    , position: scope_position
    })

  }

  description(ctx, breaking = false) {
    // Use helper functions to collect and process tokens
    const all_tokens = collectTokens(ctx, ['TEXT'])
    if (!all_tokens.length) return node.description({breaking: breaking, value: ''}, [])

    const full_text = toNormalizedText(all_tokens)
    const description_position = tokensToPosition(all_tokens)

    // Create a single text node for the description
    const text_node = node.text({value: full_text, position: description_position})

    return node.description({
      breaking: breaking
    , position: description_position
    }, [text_node])
  }

  body(ctx) {
    // Process both bodyLine nodes and BLANK_LINE tokens to preserve empty lines
    const body_lines = ctx.bodyLine || []
    const blank_lines = ctx.BLANK_LINE || []

    // Collect all items as [offset, node] tuples for sorting
    const items = []

    // Process bodyLine CST nodes into line nodes
    for (const body_line of body_lines) {
      const line_node = this.visit(body_line)
      if (!line_node) continue
      items.push([
        line_node.position?.start?.offset || 0
      , line_node
      ])
    }

    // Process BLANK_LINE tokens into line nodes with empty text
    for (const blank_token of blank_lines) {
      const position = tokenToPosition(blank_token)
      items.push([
        blank_token.startOffset || 0
      , node.line({position}, [node.text({value: '', position})])
      ])
    }

    // Sort by offset and extract nodes in a single pass
    items.sort((a, b) => {
      return a[0] - b[0]
    })

    const line_nodes = items.map((item) => {
      return item[1]
    })

    return node.body({}, line_nodes)
  }

  bodyLine(ctx) {
    // Body is an opaque blob per the spec - no issue reference parsing
    // Collect LINE_TEXT tokens (not NEW_LINE - that's just a separator)
    const all_tokens = collectTokens(ctx, ['LINE_TEXT'])
    if (!all_tokens.length) return node.line({}, [])

    const full_text = toNormalizedText(all_tokens)
    const line_position = tokensToPosition(all_tokens)

    // Create a single text node without parsing for issue references
    const text_node = node.text({value: full_text, position: line_position})

    return node.line({position: line_position}, [text_node])
  }

  // Parse issue references from CST (e.g., #123, GH-456, JIRA-ABC123)
  issuererence(ctx) {
    if (ctx.localreference) return this.visit(ctx.localreference)
    return this.visit(ctx.remotereference)
  }

  localreference(ctx) {
    const prefix_token = ctx.ISSUE_PREFIX[0]
    const id_token = ctx.identifier[0]
    const prefix = prefix_token.image
    const id_value = id_token.image
    const value = prefix + id_value

    return node.issuererence({
      value: value
    , prefix: prefix
    , id: typecast(id_value)
    , owner: null
    , repository: null
    , position: tokensToPosition([prefix_token, id_token])
    }, [node.text({value})])
  }

  remotereference(ctx) {
    const [org_token, repo_token, id_token] = ctx.identifier
    const prefix_token = ctx.ISSUE_PREFIX[0]

    const prefix = prefix_token.image
    const id_value = id_token.image
    const value = org_token.image + '/' + repo_token.image + prefix + id_value

    return node.issuererence({
      value: value
    , prefix: prefix
    , id: typecast(id_value)
    , owner: org_token.image
    , repository: repo_token.image
    , position: tokensToPosition([
        org_token
      , repo_token
      , prefix_token
      , id_token
      ])
    }, [node.text({value})])
  }

  mention(ctx) {
    const id = ctx.identifier[0]
    const at = ctx.at[0]
    return node.mention({
      username: id.image
    , prefix: at.image
    , position: tokensToPosition([at, id])
    , value: `${at.image}${id.image}`
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

    if (ctx.issuererence) {
      for (const ref_ctx of ctx.issuererence) {
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

    // Collect IDENTIFIER tokens
    if (ctx.identifier) {
      for (const token of ctx.identifier) {
        items.push({
          type: 'text_token'
        , token
        , offset: token.startOffset || 0
        })
      }
    }

    if (ctx.mention) {
      for (const ref of ctx.mention) {
        const node = this.visit(ref)
        items.push({
          type: 'mention'
        , node: node
        , offset: node.position?.start?.offset || 0
        })
      }
    }

    // Collect issue references
    if (ctx.issuererence) {
      for (const ref_ctx of ctx.issuererence) {
        const ref_node = this.visit(ref_ctx)
        items.push({
          type: 'issuererence'
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
        case 'issuererence': {
        // Flush text buffer before adding issue reference
          const text_value = text_buffer.join(' ').trim()
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
        case 'mention': {
          children.push(item.node)
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
    const text_value = text_buffer.join(' ').trim()
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
 * Converts tokens to normalized text by joining with single spaces
 * @param {Array} tokens - Array of tokens
 * @returns {string} Normalized text with single spaces between tokens
 */
function toNormalizedText(tokens) {
  return tokens.map((token) => {
    return token.image
  }).join(' ')
}
