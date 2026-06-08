'use strict'

const {Lexer} = require('chevrotain')
const {test} = require('tap')
const {testCase} = require('../common/index.js')
const {Parser, visitor: {JSONVisitor}, tokens} = require('../../lib/cast/index.js')

/**
 * Integration tests for JSONVisitor
 * These tests validate that the parser and JSONVisitor together produce the
 * expected structured JSON output from commit messages.
 */

test('JSON Visitor', async (t) => {
  testCase(t, {
    category: 'header'
  , description: 'simple conventional header'
  }, async (t) => {
    const section = 'feat: add user authentication'

    const vocabulary = tokens.createTokenVocabulary()
    const token_set = tokens.getHeaderTokens(Object.values(vocabulary))

    const parser = new Parser({}, vocabulary)
    const lexer = new Lexer(token_set)

    parser.input = lexer.tokenize(section).tokens
    const cst = parser.commit('header')
    const visitor = new JSONVisitor()

    const output = visitor.visit(cst, {header: section})

    t.equal(output.type, 'feat', 'type is feat')
    t.equal(output.subject, 'add user authentication', 'subject is correct')
    t.equal(output.scope, null, 'scope is null')
  })

  testCase(t, {
    category: 'header'
  , description: 'conventional header with scope and breaking change'
  }, async (t) => {
    const section = 'feat(api)!: add user authentication'

    const vocabulary = tokens.createTokenVocabulary()
    const token_set = tokens.getHeaderTokens(Object.values(vocabulary))

    const parser = new Parser({}, vocabulary)
    const lexer = new Lexer(token_set)

    parser.input = lexer.tokenize(section).tokens
    const cst = parser.commit('header')
    const visitor = new JSONVisitor()

    const output = visitor.visit(cst, {header: section})

    t.equal(output.type, 'feat', 'type is feat')
    t.equal(output.scope, 'api', 'scope is api')
    t.equal(output.subject, 'add user authentication', 'subject is correct')
    t.same(output.notes, [
      {title: 'BREAKING CHANGE', text: 'add user authentication'}
    ], 'breaking change note added from header bang')
  })

  testCase(t, {
    category: 'header'
  , description: 'non-conventional header'
  }, async (t) => {
    const section = 'just a simple commit message'

    const vocabulary = tokens.createTokenVocabulary()
    const token_set = tokens.getHeaderTokens(Object.values(vocabulary))

    const parser = new Parser({}, vocabulary)
    const lexer = new Lexer(token_set)

    parser.input = lexer.tokenize(section).tokens
    const cst = parser.commit('header')
    const visitor = new JSONVisitor()

    const output = visitor.visit(cst, {header: section})

    t.equal(output.subject, 'just a simple commit message', 'subject is the whole line')
    t.equal(output.type, null, 'type is null')
  })

  testCase(t, {
    category: 'footer'
  , description: 'complex footer with various trailers'
  }, async (t) => {
    const section = `
BREAKING CHANGE: this is a breaking change
Resolves: #123
Co-authored-by: John Doe <john@example.com>
  `.trim()

    const vocabulary = tokens.createTokenVocabulary()
    const token_set = tokens.getFooterTokens(Object.values(vocabulary))

    const parser = new Parser({}, vocabulary)
    const lexer = new Lexer(token_set)

    parser.input = lexer.tokenize(section).tokens
    const cst = parser.commit('footer')
    const visitor = new JSONVisitor()

    const output = visitor.visit(cst, {footer: section})

    t.same(output.notes, [
      {title: 'BREAKING CHANGE', text: 'this is a breaking change'}
    ], 'breaking change note found')

    t.ok(output.references.length > 0, 'has references')
    const ref = output.references.find((r) => { return r.issue === 123 })
    t.ok(ref, 'found reference to #123')
    t.equal(ref.raw, '#123', 'reference raw value is correct')
  })

  testCase(t, {
    category: 'footer'
  , description: 'footer with remote issue references'
  }, async (t) => {
    const section = 'Fixes: owner/repo#456'

    const vocabulary = tokens.createTokenVocabulary()
    const token_set = tokens.getFooterTokens(Object.values(vocabulary))

    const parser = new Parser({}, vocabulary)
    const lexer = new Lexer(token_set)

    parser.input = lexer.tokenize(section).tokens
    const cst = parser.commit('footer')
    const visitor = new JSONVisitor()

    const output = visitor.visit(cst, {footer: section})

    const ref = output.references[0]
    t.equal(ref.owner, 'owner', 'correct owner')
    t.equal(ref.repository, 'repo', 'correct repository')
    t.equal(ref.issue, 456, 'correct issue id')
  })

  testCase(t, {
    category: 'full'
  , description: 'full commit message parsing via JSONVisitor.commit'
  }, async (t) => {
    const chunks = {
      header: {content: 'feat(ui): add dark mode'}
    , body: {content: 'This is a great feature.'}
    , footer: {content: 'BREAKING CHANGE: colors are now dynamic\nFixes: #789'}
    }

    const vocabulary = tokens.createTokenVocabulary()
    const all_tokens = Object.values(vocabulary)
    const parser = new Parser({}, vocabulary)
    const visitor = new JSONVisitor()

    const parsed = {
      header: null
    , body: null
    , footer: null
    }
    for (const [key, chunk] of Object.entries(chunks)) {
      let token_set
      if (key === 'header') token_set = tokens.getHeaderTokens(all_tokens)
      else if (key === 'body') token_set = tokens.getBodyTokens(all_tokens)
      else if (key === 'footer') token_set = tokens.getFooterTokens(all_tokens)

      const lexer = new Lexer(token_set)
      const lexed = lexer.tokenize(chunk.content)
      parser.input = lexed.tokens
      parsed[key] = parser[key](key)
    }

    const json = visitor.visit({
      name: 'commit'
    , children: parsed
    }, chunks)

    t.equal(json.type, 'feat', 'correct type')
    t.equal(json.scope, 'ui', 'correct scope')
    t.equal(json.subject, 'add dark mode', 'correct subject')
    t.equal(json.header, chunks.header.content, 'preserves header content')
    t.equal(json.body, chunks.body.content, 'preserves body content')
    t.equal(json.footer, chunks.footer.content, 'preserves footer content')
    t.same(json.notes, [
      {title: 'BREAKING CHANGE', text: 'colors are now dynamic'}
    ], 'correct notes from footer')
    t.ok(json.references.some((r) => { return r.issue === 789 }), 'found reference #789')
  })
})
