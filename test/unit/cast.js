'use strict'

const {test} = require('tap')
const {visit} = require('unist-util-visit')

const {parse} = require('../../index.js')

test('AST basic parsing', async (t) => {
  t.test('simple feature commit', async (t) => {
    const commit = 'feat: add user authentication'
    const ast = parse(commit)

    t.equal(ast.type, 'root', 'root node type')
    t.equal(ast.breaking, false, 'not breaking')
    t.equal(ast.children.length, 1, 'has one child')
    t.equal(ast.children[0].type, 'header', 'first child is header')
  })

  t.test('breaking change header', async (t) => {
    const commit = 'feat(api)!: add user authentication'
    const ast = parse(commit)

    t.equal(ast.type, 'root', 'root node type')
    t.equal(ast.breaking, true, 'is breaking')

    const header = ast.children[0]
    t.equal(header.type, 'header', 'header node')

    // Check for bang node in header
    const bang_node = header.children.find((child) => {
      return child.type === 'bang'
    })
    t.ok(bang_node, 'has bang node')
    t.equal(bang_node.children[0].value, '!', 'bang node contains !')

    // Check for description with breaking flag
    const description_node = header.children.find((child) => {
      return child.type === 'description'
    })
    t.ok(description_node, 'has description node')
    t.equal(description_node.breaking, true, 'description has breaking flag')
  })

  t.test('complex commit with body and footer', async (t) => {
    const commit = `feat(api): add user authentication

This commit adds JWT-based authentication.

BREAKING CHANGE: authentication is now required
Resolves: #123`

    const ast = parse(commit)

    t.equal(ast.type, 'root', 'root node type')
    t.equal(ast.breaking, true, 'is breaking due to footer')
    t.equal(ast.children.length, 3, 'has three children: header, body, footer')

    const [header, body, footer] = ast.children

    t.equal(header.type, 'header', 'first child is header')
    t.equal(body.type, 'body', 'second child is body')
    t.equal(footer.type, 'footer', 'third child is footer')

    // Check trailers
    const trailers = footer.children
    t.equal(trailers.length, 2, 'has two trailers')

    const breaking_trailer = trailers[0]
    t.equal(breaking_trailer.type, 'trailer', 'first trailer type')
    t.equal(breaking_trailer.breaking, true, 'first trailer is breaking')

    const resolve_trailer = trailers[1]
    t.equal(resolve_trailer.type, 'trailer', 'second trailer type')
    t.equal(resolve_trailer.breaking, false, 'second trailer is not breaking')

  })

})

test('trailer breaking property consistency', async (t) => {
  t.test('breaking change trailer has breaking: true', async (t) => {
    const commit = `feat: add feature

BREAKING CHANGE: this breaks things`

    const ast = parse(commit)

    let breaking_trailer = null
    visit(ast, 'trailer', (node) => {
      if (node.breaking) {
        breaking_trailer = node
      }
    })

    t.ok(breaking_trailer, 'found breaking trailer')
    t.equal(breaking_trailer.breaking, true, 'breaking trailer has breaking: true')
    t.ok('breaking' in breaking_trailer, 'breaking property exists')
  })

  t.test('regular trailer has breaking: false', async (t) => {
    const commit = `feat: add feature

Resolves: #123`

    const ast = parse(commit)

    let regular_trailer = null
    visit(ast, 'trailer', (node) => {
      regular_trailer = node
    })

    t.ok(regular_trailer, 'found regular trailer')
    t.equal(regular_trailer.breaking, false, 'regular trailer has breaking: false')
    t.ok('breaking' in regular_trailer, 'breaking property exists')
  })

  t.test('all trailers have breaking property', async (t) => {
    const commit = `feat: add feature

BREAKING CHANGE: this breaks things
Resolves: #123
Co-authored-by: John Doe <john@example.com>`

    const ast = parse(commit)

    const trailers = []
    visit(ast, 'trailer', (node) => {
      trailers.push(node)
    })

    t.equal(trailers.length, 3, 'found three trailers')

    for (const trailer of trailers) {
      t.ok(
        'breaking' in trailer
      , 'trailer has breaking property'
      )
      t.equal(typeof trailer.breaking, 'boolean', 'breaking property is boolean')
    }

    t.equal(trailers[0].breaking, true, 'BREAKING CHANGE trailer is breaking')
    t.equal(trailers[1].breaking, false, 'Resolves trailer is not breaking')
    t.equal(trailers[2].breaking, false, 'Co-authored-by trailer is not breaking')

  })

})

test('position information', async (t) => {
  const commit = 'feat(api): add user authentication'
  const ast = parse(commit)

  t.test('nodes have position information', async (t) => {
    const nodes_with_position = []
    visit(ast, (node) => {
      if (node.position) {
        nodes_with_position.push(node)
      }
    })

    t.ok(nodes_with_position.length > 0, 'found nodes with position')

    // Check root position
    const root = nodes_with_position.find((n) => { return n.type === 'root' })
    t.ok(root, 'root has position')
    t.equal(root.position.start.line, 1, 'root starts at line 1')
    t.equal(root.position.start.column, 1, 'root starts at column 1')

    // Check type position
    const type = nodes_with_position.find((n) => { return n.type === 'type' })
    t.ok(type, 'type has position')
    t.equal(type.position.start.line, 1, 'type starts at line 1')
    t.equal(type.position.start.column, 1, 'type starts at column 1')
  })
})
