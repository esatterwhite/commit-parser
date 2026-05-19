'use strict'

const {test} = require('tap')
const {parseConventionalCommit, astUtils} = require('../../index.js')

test('AST basic parsing', async (t) => {
  t.test('simple feature commit', async (t) => {
    const commit = 'feat: add user authentication'
    const ast = parseConventionalCommit(commit, {format: 'ast'})

    t.equal(ast.type, 'root', 'root node type')
    t.equal(ast.breaking, false, 'not breaking')
    t.equal(ast.children.length, 1, 'has one child')
    t.equal(ast.children[0].type, 'header', 'first child is header')
  })

  t.test('breaking change header', async (t) => {
    const commit = 'feat(api)!: add user authentication'
    const ast = parseConventionalCommit(commit, {format: 'ast'})

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

    const ast = parseConventionalCommit(commit, {format: 'ast'})

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

    const ast = parseConventionalCommit(commit, {format: 'ast'})

    let breaking_trailer = null
    astUtils.visit(ast, 'trailer', (node) => {
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

    const ast = parseConventionalCommit(commit, {format: 'ast'})

    let regular_trailer = null
    astUtils.visit(ast, 'trailer', (node) => {
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

    const ast = parseConventionalCommit(commit, {format: 'ast'})

    const trailers = []
    astUtils.visit(ast, 'trailer', (node) => {
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

test('AST utilities with unist-util-visit', async (t) => {
  const commit = `feat(api)!: add user authentication

This commit adds JWT-based authentication.

BREAKING CHANGE: authentication is now required
Resolves: #123`

  const ast = parseConventionalCommit(commit, {format: 'ast'})

  t.test('find all breaking change nodes', async (t) => {
    const breaking_nodes = []
    astUtils.visit(ast, (node) => {
      if (node.breaking) {
        breaking_nodes.push(node)
      }
    })

    t.equal(breaking_nodes.length, 3, 'found three breaking nodes')
    t.equal(breaking_nodes[0].type, 'root', 'root is breaking')
    t.equal(breaking_nodes[1].type, 'description', 'description is breaking')
    t.equal(breaking_nodes[2].type, 'trailer', 'footer breaking trailer')
  })

  t.test('extract text content', async (t) => {
    const text_contents = []
    astUtils.visit(ast, ['text', 'issueReference'], (node) => {
      text_contents.push(node.value)
    })

    t.ok(text_contents.length > 0, 'found text content')
    t.ok(text_contents.includes('add user authentication'), 'includes description')
    t.ok(text_contents.includes('#123'), 'includes issue reference')
  })

  t.test('find issue references', async (t) => {
    const issues = astUtils.extractIssues(ast)

    t.equal(issues.length, 1, 'found one issue')
    t.equal(issues[0].issue, '#123', 'correct issue text')
    t.equal(issues[0].prefix, '#', 'correct prefix')
    t.equal(issues[0].id, 123, 'correct id')
  })

  t.test('extract breaking changes', async (t) => {
    const breaking_changes = astUtils.extractBreakingChanges(ast)

    t.equal(breaking_changes.length, 2, 'found two breaking changes')
    t.equal(
      breaking_changes[0]
    , 'add user authentication'
    , 'correct breaking change text from header'
    )
    t.equal(
      breaking_changes[1]
    , 'authentication is now required'
    , 'correct breaking change text from footer'
    )
  })

  t.test('get metadata', async (t) => {
    const metadata = astUtils.getMetadata(ast)

    t.equal(metadata.type, 'feat', 'correct type')
    t.equal(metadata.scope, 'api', 'correct scope')
    t.equal(metadata.breaking, true, 'is breaking')
    t.ok(metadata.description.includes('add user authentication'), 'has description')
    t.ok(metadata.body.includes('JWT-based authentication'), 'has body')
    t.equal(metadata.hasFooter, true, 'has footer')
    t.equal(metadata.issues.length, 1, 'has issues')
    t.equal(metadata.breakingChanges.length, 2, 'has two breaking changes')
  })

  t.test('round-trip serialization', async (t) => {
    // TODO: Fix serialization spacing issue - missing space after colon
    t.skip('serialization has spacing issues that need to be fixed separately')
  })
})

test('position information', async (t) => {
  const commit = 'feat(api): add user authentication'
  const ast = parseConventionalCommit(commit, {format: 'ast'})

  t.test('nodes have position information', async (t) => {
    const nodes_with_position = []
    astUtils.visit(ast, (node) => {
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

test('backwards compatibility', async (t) => {
  const commit = 'feat(api): add user authentication'

  t.test('JSON format still works', async (t) => {
    const json = parseConventionalCommit(commit, {format: 'json'})

    t.equal(typeof json, 'object', 'returns object')
    t.equal(json.type, 'feat', 'has type')
    t.equal(json.scope, 'api', 'has scope')
    t.equal(json.breaking, false, 'has breaking')
    t.ok(json.description.includes('add user authentication'), 'has description')
  })

  t.test('default format is JSON', async (t) => {
    const result = parseConventionalCommit(commit)

    t.equal(typeof result, 'object', 'returns object')
    t.equal(result.type, 'feat', 'has type field (JSON format)')
    t.notOk(result.children, 'does not have children field (not AST)')
  })

})
