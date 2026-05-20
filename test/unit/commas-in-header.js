'use strict'

/**
 * @module test/unit/commas-in-header
 * @description Test that commas work correctly in descriptions and scopes
 */

const {test} = require('tap')
const {parse} = require('../../index.js')

test('Commas in header components', async (t) => {
  t.test('should parse description with commas', async (t) => {
    const commit = 'feat: add CSV, JSON, and XML support'

    const result = parse(commit)

    t.ok(result, 'should return result')
    t.equal(result.type, 'root', 'root node type')

    const header = result.children.find((child) => {
      return child.type === 'header'
    })
    t.ok(header, 'should have header')

    const description = header.children.find((child) => {
      return child.type === 'description'
    })
    t.ok(description, 'should have description')
    t.equal(
      description.value
    , 'add CSV, JSON, and XML support'
    , 'description should include commas'
    )
  })

  t.test('should parse scope with commas', async (t) => {
    const commit = 'feat(parser, lexer): improve performance'

    const result = parse(commit)

    t.ok(result, 'should return result')
    t.equal(result.type, 'root', 'root node type')

    const header = result.children.find((child) => {
      return child.type === 'header'
    })
    t.ok(header, 'should have header')

    const scope = header.children.find((child) => {
      return child.type === 'scope'
    })
    t.ok(scope, 'should have scope')
    t.equal(scope.value, 'parser, lexer', 'scope should include comma')
  })

  t.test('should parse scope with multiple words and commas', async (t) => {
    const commit = 'fix(api client, auth service, data layer): resolve race condition'

    const result = parse(commit)

    const header = result.children.find((child) => {
      return child.type === 'header'
    })
    const scope = header.children.find((child) => {
      return child.type === 'scope'
    })
    t.ok(scope, 'should have scope')
    t.equal(
      scope.value
    , 'api client, auth service, data layer'
    , 'scope should include commas and spaces'
    )
  })

  t.test('should parse description with commas and breaking change', async (t) => {
    const commit = 'feat!: change API to accept CSV, JSON, or XML formats'

    const result = parse(commit)

    t.equal(result.breaking, true, 'should be breaking')

    const header = result.children.find((child) => {
      return child.type === 'header'
    })
    const description = header.children.find((child) => {
      return child.type === 'description'
    })
    t.ok(description, 'should have description')
    t.equal(description.breaking, true, 'description should be marked as breaking')
    t.equal(
      description.value
    , 'change API to accept CSV, JSON, or XML formats'
    , 'description should include commas'
    )
  })

  t.test('should parse complex commit with commas in multiple places', async (t) => {
    const commit = `feat(parser, lexer, visitor): add CSV, JSON, and XML support

This commit adds support for multiple formats: CSV, JSON, and XML.

Closes: #1, #2, #3`

    const result = parse(commit)

    t.ok(result, 'should return result')

    // Check header
    const header = result.children.find((child) => {
      return child.type === 'header'
    })
    const scope = header.children.find((child) => {
      return child.type === 'scope'
    })
    t.equal(
      scope.value
    , 'parser, lexer, visitor'
    , 'scope should include commas'
    )

    const description = header.children.find((child) => {
      return child.type === 'description'
    })
    t.equal(
      description.value
    , 'add CSV, JSON, and XML support'
    , 'description should include commas'
    )

    // Check body
    const body = result.children.find((child) => {
      return child.type === 'body'
    })
    t.ok(body, 'should have body')
    t.ok(
      body.children[0].children[0].value.includes('CSV, JSON, and XML')
    , 'body should include commas'
    )

    // Check footer
    const footer = result.children.find((child) => {
      return child.type === 'footer'
    })
    t.ok(footer, 'should have footer')

    const trailer = footer.children[0]
    const trailer_value = trailer.children.find((child) => {
      return child.type === 'trailervalue'
    })

    // Should have 3 issue references (CSV pattern)
    const issue_refs = trailer_value.children.filter((child) => {
      return child.type === 'issueReference'
    })
    t.equal(issue_refs.length, 3, 'should have three issue references')
  })
})

