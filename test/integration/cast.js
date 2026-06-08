'use strict'

const {Lexer} = require('chevrotain')
const {test} = require('tap')
const {select, selectAll} = require('unist-util-select')
const {testCase} = require('../common/index.js')
const {Parser, visitor: {CASTVisitor}, tokens} = require('../../lib/cast/index.js')

test('CAST', async (t) => {
  testCase(t, {
    category: 'header'
  , description: 'header only'
  }, async (t) => {
    const section = 'feat: add user authentication'

    const vocabulary = tokens.createTokenVocabulary()
    const token_set = tokens.getHeaderTokens(Object.values(vocabulary))

    const parser = new Parser()
    const lexer = new Lexer(token_set)

    const lexed = lexer.tokenize(section)
    parser.input = lexed.tokens

    const cst = parser.commit('header')
    const visitor = new CASTVisitor()

    const cast = visitor.visit(cst)
    t.equal(cast.type, 'root', 'root node type')
    t.equal(cast.breaking, false, 'not breaking')

    const header = select('header', cast)
    t.ok(header, 'has header node')
  })

  testCase(t, {
    category: 'header'
  , description: 'breaking change header'
  }, async (t) => {
    const section = 'feat(api)!: add user authentication'

    const vocabulary = tokens.createTokenVocabulary()
    const token_set = tokens.getHeaderTokens(Object.values(vocabulary))

    const parser = new Parser()
    const lexer = new Lexer(token_set)

    const lexed = lexer.tokenize(section)
    parser.input = lexed.tokens

    const cst = parser.commit('header')
    const visitor = new CASTVisitor()

    const cast = visitor.visit(cst)

    t.equal(cast.type, 'root', 'root node type')
    t.equal(cast.breaking, true, 'is breaking')

    const header = select('header', cast)
    t.ok(header, 'has header node')
    t.equal(header.type, 'header', 'header node')

    {
      // Check for bang node in header
      const bang_node = select('bang', header)
      t.ok(bang_node, 'has bang node')

      const text_nodes = selectAll('text', bang_node)
      t.same(text_nodes, [
        {value: '!', type: 'text'}
      ], 'bang node contains !')
    }

    {
      const description_node = select('description', header)
      t.match(description_node, {
        breaking: true
      }, 'description has breaking flag')

      const text_nodes = selectAll('text', description_node)
      t.match(text_nodes, [
        {type: 'text', value: 'add user authentication'}
      ], 'description contains text from header')
    }
  })

  testCase(t, {
    category: 'complex'
  , description: 'commit with body and footer'
  }, async (t) => {
    const commit = {
      header: 'feat(api): add user authentication'
    , body: 'This commit adds JWT-based authentication.'
    , footer: 'BREAKING CHANGE: authentication is now required\nResolves: #123'
    }

    const vocabulary = tokens.createTokenVocabulary()
    const all_tokens = Object.values(vocabulary)
    const parser = new Parser({}, vocabulary)
    const visitor = new CASTVisitor()

    testCase(t, {
      category: 'header'
    , description: 'header parsing tree'
    }, async (t) => {
      const token_set = tokens.getHeaderTokens(all_tokens)
      const lexer = new Lexer(token_set)
      parser.input = lexer.tokenize(commit.header).tokens
      const root = visitor.visit(parser.commit('header'))

      t.equal(root.type, 'root', 'header root type')
      const header = select('header', root)
      t.ok(header, 'has header node')
      t.equal(header.type, 'header', 'header section type')
    })

    testCase(t, {
      category: 'body'
    , description: 'body parsing tree'
    }, async (t) => {
      const token_set = tokens.getBodyTokens(all_tokens)
      const lexer = new Lexer(token_set)
      parser.input = lexer.tokenize(commit.body).tokens
      const root = visitor.visit(parser.commit('body'))

      t.equal(root.type, 'root', 'body root type')
      const body = select('body', root)
      t.ok(body, 'has body node')
      t.equal(body.type, 'body', 'body section type')
    })

    testCase(t, {
      category: 'footer'
    , description: 'footer parsing tree'
    }, async (t) => {

      const token_set = tokens.getFooterTokens(all_tokens)
      const lexer = new Lexer(token_set)
      parser.input = lexer.tokenize(commit.footer).tokens

      const cst = parser.commit('footer')
      const root = visitor.visit(cst)

      t.equal(root.type, 'root', 'footer root type')
      const footer = select('footer', root)
      t.ok(footer, 'has footer node')
      t.equal(footer.type, 'footer', 'footer section type')

      // Check trailers in footer
      const trailers = selectAll('trailer', root)
      t.equal(trailers.length, 2, 'has two trailers')

      const breaking_trailer = trailers.find((node) => {
        return node.breaking
      })
      t.ok(breaking_trailer, 'found breaking trailer')
      t.equal(breaking_trailer.type, 'trailer', 'first trailer type')
      t.equal(breaking_trailer.breaking, true, 'first trailer is breaking')

      const resolve_trailer = trailers.find((node) => {
        return !node.breaking
      })
      t.ok(resolve_trailer, 'found regular trailer')
      t.equal(resolve_trailer.type, 'trailer', 'second trailer type')
      t.equal(resolve_trailer.breaking, false, 'second trailer is not breaking')
    })
  })

  testCase(t, {
    category: 'footer'
  , description: 'breaking change trailer has breaking: true'
  }, async (t) => {
    const section = 'BREAKING CHANGE: this breaks things'

    const vocabulary = tokens.createTokenVocabulary()
    const token_set = tokens.getFooterTokens(Object.values(vocabulary))

    const parser = new Parser({}, vocabulary)
    const lexer = new Lexer(token_set)

    const lexed = lexer.tokenize(section)
    parser.input = lexed.tokens

    const cst = parser.commit('footer')
    const visitor = new CASTVisitor()
    const cast = visitor.visit(cst)

    const breaking_trailer = select('footer > trailer[breaking=true]', cast)
    t.ok(breaking_trailer, 'found breaking trailer')
    t.equal(breaking_trailer.breaking, true, 'breaking trailer has breaking: true')
  })

  testCase(t, {
    category: 'footer'
  , description: 'regular trailer has breaking: false'
  }, async (t) => {
    const section = 'Resolves: #123'

    const vocabulary = tokens.createTokenVocabulary()
    const token_set = tokens.getFooterTokens(Object.values(vocabulary))

    const parser = new Parser({}, vocabulary)
    const lexer = new Lexer(token_set)

    const lexed = lexer.tokenize(section)
    parser.input = lexed.tokens

    const cst = parser.commit('footer')
    const visitor = new CASTVisitor()
    const cast = visitor.visit(cst)

    const regular_trailer = select('footer > trailer:not([breaking=true])', cast)
    t.ok(regular_trailer, 'found regular trailer')
    t.equal(regular_trailer.breaking, false, 'regular trailer has breaking: false')
  })

  testCase(t, {
    category: 'footer'
  , description: 'all trailers have breaking property'
  }, async (t) => {
    const section = `BREAKING CHANGE: this breaks things
Resolves: #123
Co-authored-by: John Doe <john@example.com>`

    const vocabulary = tokens.createTokenVocabulary()
    const token_set = tokens.getFooterTokens(Object.values(vocabulary))

    const parser = new Parser({}, vocabulary)
    const lexer = new Lexer(token_set)

    const lexed = lexer.tokenize(section)
    parser.input = lexed.tokens

    const cst = parser.commit('footer')
    const visitor = new CASTVisitor()
    const cast = visitor.visit(cst)

    const trailers = selectAll('trailer', cast)
    t.equal(trailers.length, 3, 'found three trailers')

    for (const trailer of trailers) {
      t.type(trailer.breaking, 'boolean', 'trailer breaking property is boolean')
    }

    t.equal(trailers[0].breaking, true, 'BREAKING CHANGE trailer is breaking')
    t.equal(trailers[1].breaking, false, 'Resolves trailer is not breaking')
    t.equal(trailers[2].breaking, false, 'Co-authored-by trailer is not breaking')
  })

  testCase(t, {
    category: 'position'
  , description: 'nodes have position information'
  }, async (t) => {
    const section = 'feat(api): add user authentication'

    const vocabulary = tokens.createTokenVocabulary()
    const token_set = tokens.getHeaderTokens(Object.values(vocabulary))

    const parser = new Parser()
    const lexer = new Lexer(token_set)

    const lexed = lexer.tokenize(section)
    parser.input = lexed.tokens

    const cst = parser.commit('header')
    const visitor = new CASTVisitor()
    const cast = visitor.visit(cst)

    const nodes_with_position = selectAll('*[position]', cast)

    t.ok(nodes_with_position.length, 'found nodes with position')

    const header = select('header', cast)
    t.ok(header, 'header has position')
    t.equal(header.position.start.line, 1, 'header starts at line 1')
    t.equal(header.position.start.column, 1, 'header starts at column 1')
  })
})
