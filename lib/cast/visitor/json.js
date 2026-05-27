'use strict'

const ASTVisitor = require('./ast.js')
const transform = require('./transform/index.js')
const typecast = require('../../lang/string/typecast.js')

class JSONVisitor extends ASTVisitor {
  commit(ctx, chunks) {
    const output = {
      revert: null
    , merge: null
    , header: chunks?.header?.content ?? null
    , body: chunks?.body?.content ?? null
    , footer: chunks.footer?.content ?? null
    , notes: []
    , mentions: []
    , references: []
    , trailers: {}
    , scope: null
    , subject: null
    , type: null
    , raw: null
    }

    this.visit(ctx.header, output)

    if (ctx.footer) this.visit(ctx.footer, output)
    return output
  }

  header(ctx, output) {
    // Header now has two alternatives: conventionalHeader or description
    if (ctx.conventionalHeader) return this.visit(ctx.conventionalHeader, output)

    // Non-conventional commit: just description
    if (ctx.description) return this.visit(ctx.description, output)

    return output
  }

  conventionalHeader(ctx, output) {
    if (ctx.type) this.visit(ctx.type, output)
    if (ctx.scope) this.visit(ctx.scope, output)

    // Add description node with breaking flag
    if (ctx.description) {
      const desc = this.visit(ctx.description, output)
      const breaking = !!ctx.BANG?.[0]
      if (breaking) output.notes.push(desc)
    }

    return output
  }

  description(ctx, output) {
    const description = transform.toString(transform.collectTokens(ctx, ['TEXT']))
    output.summary = description
    return description
  }

  type(ctx, output) {
    // Type can be either TEXT or FOOTER_TOKEN
    const type = transform.toString(ctx.TEXT ? ctx.TEXT : ctx.FOOTER_TOKEN)
    output.type = type
    return type
  }

  scope(ctx, output) {
    // Add scope content using helper functions
    const scope = transform.toString(transform.collectTokens(ctx, ['TEXT']))
    output.scope = scope
    return scope
  }

  mention(ctx, output) {
    const mention = transform.toString(ctx.identifier)
    const prefix = ctx.at[0].image
    output.mentions.push(mention)
    return {value: `${prefix}${mention}`, offset: ctx.identifier[0].startOffset}
  }

  footer(ctx, output) {
    for (const trailer of ctx.trailer) {
      this.visit(trailer, output)
    }
  }

  trailer(ctx, output) {
    const key = this.visit(ctx.trailerkey, output)
    const value = this.visit(ctx.trailervalue, output)
    if (key.breaking) output.notes.push(value)
    return value
  }

  trailerkey(ctx) {
    if (ctx.BREAKING_CHANGE_TOKEN) {
      return {token: ctx.BREAKING_CHANGE_TOKEN[0], breaking: true}
    } else if (ctx.FOOTER_TOKEN) {
      return {token: ctx.FOOTER_TOKEN[0], breaking: false}
    }
  }

  trailervalue(ctx, output) {
    // Collect all children from all lines
    const result = ctx.trailervalueline.map((line) => {
      return this.visit(line, output)
    })

    return result
  }

  trailervalueline(ctx, output) {
    // Trailer value line can be either issues or mixedcontent
    if (ctx.issues) return this.visit(ctx.issues, output)
    if (ctx.mixedcontent) return this.visit(ctx.mixedcontent, output)
    return []
  }

  issues(ctx, output) {
    for (const issue of ctx.issues) {
      this.visit(issue, output)
    }
  }

  // Parse issue references from CST (e.g., #123, GH-456, JIRA-ABC123)
  issuererence(ctx, output) {
    if (ctx.localreference) return this.visit(ctx.localreference, output)
    return this.visit(ctx.remotereference, output)
  }

  localreference(ctx, output) {
    const prefix_token = ctx.ISSUE_PREFIX[0]
    const id_token = ctx.identifier[0]
    const prefix = prefix_token.image
    const id_value = id_token.image
    const value = prefix + id_value

    output.references.push({
      value: value
    , prefix: prefix
    , id: typecast(id_value)
    , owner: null
    , repository: null
    })

    return {value, offset: prefix_token.startOffset}
  }

  remotereference(ctx, output) {
    const [org_token, repo_token, id_token] = ctx.identifier
    const prefix_token = ctx.ISSUE_PREFIX[0]

    const prefix = prefix_token.image
    const id_value = id_token.image
    const value = org_token.image + '/' + repo_token.image + prefix + id_value

    output.references.push({
      value: value
    , prefix: prefix
    , id: typecast(id_value)
    , owner: org_token.image
    , repository: repo_token.image
    })

    return {value, offset: prefix_token.startOffset}
  }

  mixedcontent(ctx, output) {
    // Mixed content: text and issue references with commas included
    const items = []
    if (ctx.mention) {
      for (const ref of ctx.mention) {
        const value = this.visit(ref, output)
        items.push(value)
      }
    }

    // Collect issue references
    if (ctx.issuererence) {
      for (const ref of ctx.issuererence) {
        const value = this.visit(ref, output)
        items.push(value)
      }
    }

    if (ctx.identifier) {

      for (const ref of ctx.identifier) {
        const value = ref.image
        items.push({value, offset: ref.startOffset})
      }
    }

    if (ctx.LINE_TEXT) {
      for (const token of ctx.LINE_TEXT) {
        items.push({value: token.image, offset: token.startOffset})
      }
    }

    items.sort((a, b) => {
      return a.offset - b.offset
    })

    return items.map((item) => {
      return item.value
    }).join(' ')
  }

}

module.exports = JSONVisitor
