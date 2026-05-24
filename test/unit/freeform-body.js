'use strict'

const fs = require('node:fs')
const path = require('node:path')
const {test} = require('tap')
const {select, selectAll} = require('unist-util-select')
const testCase = require('../common/test-case.js')
const parser = require('../../index.js')

// Load the fixture
const COMMIT = fs.readFileSync(
  path.join(__dirname, '../fixtures/freeform-body/commit.txt'),
  'utf8'
)

test('free-form body parsing', async (t) => {
  t.test('should parse without throwing', async (t) => {
    t.doesNotThrow(() => {
      parser.parse(COMMIT)
    }, 'parser.parse does not throw')
  })

  t.test('should return correct structure', async (t) => {
    const result = parser.parse(COMMIT)

    t.equal(result.type, 'root', 'root node type')
    t.equal(result.breaking, true, 'should be breaking due to ! in header')
    t.type(result.children, 'array', 'should have children array')
    t.equal(result.children.length, 3, 'should have header, body, and footer')
  })

  testCase(t, {
    category: 'header'
  , description: 'conventional commit parser output'
  }, async (t) => {
    const result = parser.parse(COMMIT)

    const header = select('header', result)
    t.ok(header, 'should have header section')
    t.ok(Array.isArray(header.children), 'header should have children')

    t.test('type', async (t) => {
      // Check for type
      const type_node = select('type', header)
      t.ok(type_node, 'should have type node')
      t.equal(type_node.value, 'feat', 'type should be feat')
    })

    t.test('bang', async (t) => {
      // Check for bang indicator
      const bang = select('bang', header)
      t.ok(bang, 'should have bang node due to !')
    })

    t.test('description', async (t) => {
    // Check for description
      const description = select('description', header)
      t.ok(description, 'should have description node')

      t.match(select('text', description), {
        type: 'text'
      , value: 'test'
      , position: Object
      }, 'description should be test')
    })
  })

  testCase(t, {
    category: 'body'
  , description: 'parser output'
  }, async (t) => {
    const result = parser.parse(COMMIT)

    const body = result.children.find((child) => {
      return child.type === 'body'
    })
    t.ok(body, 'should have body section')
    t.ok(Array.isArray(body.children), 'body should have children')
    t.equal(body.children.length, 4, 'number of lines parsed')

    const text = selectAll('line text', body).map((node) => {
      return node.value
    })

    t.match(text, [
      'one(four): test'
    , 'two: #100'
    , ''
    , 'three!'
    ], 'body line > text values')

  })

  testCase(t, {
    category: 'footer'
  , description: 'parser output'
  }, async (t) => {
    const result = parser.parse(COMMIT)

    const footer = select('footer', result)
    t.ok(footer, 'should have footer section')
    t.ok(Array.isArray(footer.children), 'footer should have children')
    t.equal(footer.children.length, 2, 'footer should have 2 trailers')

    t.test('trailers', async (t) => {
      t.test('breaking change', async (t) => {
        const trailer = footer.children[0]
        t.match(trailer, {
          type: 'trailer'
        , breaking: true
        }, 'BREAKING CHANGE marks node breaking=true')

        t.match(select('trailerkey text', trailer), {
          type: 'text'
        , value: 'BREAKING CHANGE'
        }, 'trailer key text')

        t.match(select('trailervalue text', trailer), {
          type: 'text'
        , value: 'this is a breaking change'
        }, 'trailer value text')

      })

      t.test('simple Git trailer', async (t) => {
        const trailer = footer.children[1]
        t.equal(trailer.type, 'trailer', 'should have Fixes trailer')
        t.equal(trailer.breaking, false, 'Fixes should not be breaking')

        const key = select('trailerkey', trailer)
        const value = select('trailervalue', trailer)

        t.ok(key, 'should have trailerkey for Fixes')
        t.ok(value, 'should have trailervalue for Fixes')

        t.test('issue reference', async (t) => {
          t.ok(select('issuererence', value), {
            type: 'issuererence'
          , value: '#1'
          , id: 1
          , prefix: '#'
          }, 'Fixes value should have issue reference')
        })
      })
    })

  })
})

