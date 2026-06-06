'use strict'

const ASTVisitor = require('./ast.js')
const transform = require('./transform/index.js')
const typecast = require('../../lang/string/typecast.js')

class JSONVisitor extends ASTVisitor {
  #action = null
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
    if (ctx.conventionalHeader) return this.visit(ctx.conventionalHeader, output)
    if (ctx.description) return this.visit(ctx.description, output)
    return output
  }

  conventionalHeader(ctx, output) {
    if (ctx.type) this.visit(ctx.type, output)
    if (ctx.scope) this.visit(ctx.scope, output)

    if (ctx.description) {
      const desc = this.visit(ctx.description, output)
      const breaking = !!ctx.BANG?.[0]
      if (breaking) output.notes.push({title: 'BREAKING CHANGE', text: desc})
    }

    return output
  }

  description(ctx, output) {
    const description = transform.toString(transform.collectTokens(ctx, ['TEXT']))
    output.subject = description
    return description
  }

  type(ctx, output) {
    const type = transform.toString(ctx.TEXT ? ctx.TEXT : ctx.FOOTER_TOKEN)
    output.type = type
    return type
  }

  scope(ctx, output) {
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

    if (key.referenceAction) this.#action = key.token.image
    const value = this.visit(ctx.trailervalue, output)
    if (key.breaking) {
      output.notes.push({
        title: key.token.image
      , text: Array.isArray(value) ? value[0] : value
      })
    }

    this.#action = null
    return value
  }

  trailerkey(ctx, output) {
    if (ctx.BREAKING_CHANGE) return {token: ctx.BREAKING_CHANGE[0], breaking: true}
    if (ctx.referenceaction) return this.visit(ctx.referenceaction, output)
    if (ctx.FOOTER_TOKEN) return {token: ctx.FOOTER_TOKEN[0], breaking: false}
  }

  trailervalue(ctx, output) {
    const result = ctx.trailervalueline.map((line) => {
      return this.visit(line, output)
    })

    return result
  }

  trailervalueline(ctx, output) {
    if (ctx.issues) return this.visit(ctx.issues, output)
    if (ctx.metadata) return this.visit(ctx.metadata, output)
    return []
  }

  issues(ctx, output) {
    for (const issue of ctx.issues) {
      this.visit(issue, output)
    }
  }

  issuereference(ctx, output) {
    if (ctx.localreference) return this.visit(ctx.localreference, output)
    if (ctx.reporeference) return this.visit(ctx.reporeference, output)
    return this.visit(ctx.remotereference, output)
  }

  reporeference(ctx, output) {
    const [id_token] = ctx.identifier
    const {payload} = ctx.REPO_AND_PREFIX[0]
    const prefix = payload.prefix
    const id_value = id_token.image
    const repo = payload.identifier
    const value = prefix + id_value

    output.references.push({
      raw: value
    , action: this.#action
    , prefix: prefix
    , issue: typecast(id_value)
    , owner: null
    , repository: repo
    })

    return {value, offset: ctx.REPO_AND_PREFIX[0].startOffset}
  }

  localreference(ctx, output) {
    const prefix_token = ctx.REPO_AND_PREFIX?.[0] ?? ctx.ISSUE_PREFIX[0]
    const id_token = ctx.identifier[0]
    const prefix = prefix_token.image
    const id_value = id_token.image
    const value = prefix + id_value

    output.references.push({
      raw: value
    , action: this.#action
    , prefix: prefix
    , issue: typecast(id_value)
    , owner: null
    , repository: null
    })

    return {value, offset: prefix_token.startOffset}
  }

  remotereference(ctx, output) {
    const [org_token, id_token] = ctx.identifier
    const prefix_token = ctx.REPO_AND_PREFIX[0]
    const payload = prefix_token.payload

    const prefix = payload.prefix
    const repo = payload.identifier
    const id_value = id_token.image
    const value = org_token.image + '/' + repo + prefix + id_value

    output.references.push({
      raw: value
    , action: this.#action
    , prefix: prefix
    , issue: typecast(id_value)
    , owner: org_token.image
    , repository: repo
    })

    return {value, offset: prefix_token.startOffset}
  }

  metadata(ctx, output) {
    const items = []

    if (ctx.LINE_TEXT) {
      for (const token of ctx.LINE_TEXT) {
        items.push({
          value: token.image
        , offset: token.startOffset
        })
      }
    }

    if (ctx.identifier) {
      for (const token of ctx.identifier) {
        items.push({value: token.image, offset: token.startOffset})
      }
    }

    if (ctx.mention) {
      for (const ref of ctx.mention) {
        const value = this.visit(ref, output)
        items.push(value)
      }
    }

    if (ctx.issuereference) {
      for (const ref_ctx of ctx.issuereference) {
        const value = this.visit(ref_ctx, output)
        items.push(value)
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
