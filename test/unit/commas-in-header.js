'use strict'

/**
 * @module test/unit/commas-in-header
 * @description Test that commas work correctly in descriptions and scopes
 */

const {test} = require('tap')
const {select, selectAll} = require('unist-util-select')
const testCase = require('../common/test-case.js')
const parser = require('../../index.js')

// Test fixtures
const COMMIT_DESCRIPTION_WITH_COMMAS = 'feat: add CSV, JSON, and XML support'
const COMMIT_SCOPE_WITH_COMMAS = 'feat(parser, lexer): improve performance'
const COMMIT_SCOPE_WITH_MULTIPLE_WORDS = [
  'fix(api client, auth service, data layer): '
, 'resolve race condition'
].join('')
const COMMIT_BREAKING_WITH_COMMAS = [
  'feat!: change API to accept CSV, JSON, or XML formats'
].join('')
const COMMIT_COMPLEX = `feat(parser, lexer, visitor): add CSV, JSON, and XML support

This commit adds support for multiple formats: CSV, JSON, and XML.

Closes: #1, #2, #3`

test('commas in header components', async (t) => {
  testCase(t, {
    category: 'description'
  , description: 'should parse description with commas'
  }, async (t) => {
    const result = parser.parse(COMMIT_DESCRIPTION_WITH_COMMAS)

    t.equal(result.type, 'root', 'root node type')

    const description = select('description', result)
    t.match(description, {
      type: 'description'
    , breaking: false
    }, 'description node')

    t.match(select('text', description), {
      type: 'text'
    , value: 'add CSV, JSON, and XML support'
    }, 'description text value')
  })

  testCase(t, {
    category: 'scope'
  , description: 'should parse scope with commas'
  }, async (t) => {
    const result = parser.parse(COMMIT_SCOPE_WITH_COMMAS)

    t.equal(result.type, 'root', 'root node type')

    const scope = select('scope', result)
    t.match(scope, {
      type: 'scope'
    , value: 'parser, lexer'
    }, 'scope node with comma-separated values')
  })

  testCase(t, {
    category: 'scope'
  , description: 'should parse scope with multiple words and commas'
  }, async (t) => {
    const result = parser.parse(COMMIT_SCOPE_WITH_MULTIPLE_WORDS)

    const scope = select('scope', result)
    t.match(scope, {
      type: 'scope'
    , value: 'api client, auth service, data layer'
    }, 'scope node with multi-word comma-separated values')
  })

  testCase(t, {
    category: 'breaking change'
  , description: 'should parse description with commas and breaking indicator'
  }, async (t) => {
    const result = parser.parse(COMMIT_BREAKING_WITH_COMMAS)

    t.equal(result.breaking, true, 'root should be breaking')

    const header = select('header', result)
    t.ok(header, 'should have header')

    const bang = select('bang', header)
    t.ok(bang, 'should have bang node')

    const description = select('description', header)
    t.match(description, {
      type: 'description'
    , breaking: true
    }, 'description node should be breaking')

    t.match(select('text', description), {
      type: 'text'
    , value: 'change API to accept CSV, JSON, or XML formats'
    }, 'description text with commas')
  })

  testCase(t, {
    category: 'complex commit'
  , description: 'should parse commit with commas in header, body, and footer'
  }, async (t) => {
    const result = parser.parse(COMMIT_COMPLEX)

    t.equal(result.type, 'root', 'root node type')

    t.test('header section', async (t) => {
      const header = select('header', result)
      t.ok(header, 'should have header')

      const scope = select('scope', header)
      t.match(scope, {
        type: 'scope'
      , value: 'parser, lexer, visitor'
      }, 'scope with three comma-separated values')

      const description = select('description', header)
      t.match(select('text', description), {
        type: 'text'
      , value: 'add CSV, JSON, and XML support'
      }, 'description with commas')
    })

    t.test('body section', async (t) => {
      const body = select('body', result)
      t.ok(body, 'should have body')

      const body_text = select('line text', body)
      t.match(body_text, {
        type: 'text'
      , value: 'This commit adds support for multiple formats: CSV, JSON, and XML.'
      }, 'body text with commas')
    })

    t.test('footer section', async (t) => {
      const footer = select('footer', result)
      t.ok(footer, 'should have footer')

      const trailer = select('trailer', footer)
      t.match(trailer, {
        type: 'trailer'
      , breaking: false
      }, 'trailer node')

      const trailer_key = select('trailerkey text', trailer)
      t.match(trailer_key, {
        type: 'text'
      , value: 'Closes'
      }, 'trailer key')

      const issue_refs = selectAll('issuererence', trailer)
      t.equal(issue_refs.length, 3, 'should have three issue references')

      t.match(issue_refs[0], {
        type: 'issuererence'
      , prefix: '#'
      , id: 1
      }, 'first issue reference')

      t.match(issue_refs[1], {
        type: 'issuererence'
      , prefix: '#'
      , id: 2
      }, 'second issue reference')

      t.match(issue_refs[2], {
        type: 'issuererence'
      , prefix: '#'
      , id: 3
      }, 'third issue reference')
    })
  })
})

