'use strict'

const {test} = require('tap')
const {testCase} = require('../common/index.js')
const parser = require('../../index.js')

// Fixture: The problematic commit message that was causing "Redundant input, expecting EOF"
const PROBLEMATIC_COMMIT = `
feat(test)!: i broke a thing

This is a body with some content.
BREAKING CHANGE in body is not a footer.

It's just text in the body that happens to contain the phrase.

Footer: yes
`.trim()

function extract_text(node) {
  if (node.type === 'text') {
    return node.value
  }
  if (node.children) {
    return node.children.map(extract_text).join('')
  }
  return ''
}
test('problematic commit parsing', async (t) => {
  t.doesNotThrow(() => {
    parser.parse(PROBLEMATIC_COMMIT)
  }, 'parser.parse does not throw')

  t.test('should return correct structure', async (t) => {
    const result = parser.parse(PROBLEMATIC_COMMIT)

    t.equal(result.type, 'root', 'root node type')
    t.equal(result.breaking, true, 'should be breaking due to ! in header')
    t.type(result.children, 'array', 'should have children array')
    t.equal(result.children.length, 3, 'parsed sections')
  })

  testCase(t, {
    category: 'header'
  , description: 'header section parsing'
  }, async (t) => {
    const result = parser.parse(PROBLEMATIC_COMMIT)

    const header = result.children.find((child) => {
      return child.type === 'header'
    })
    t.ok(header, 'should have header section')
    t.ok(Array.isArray(header.children), 'header should have children')

    t.test('type', async (t) => {
      const type_node = header.children.find((child) => {
        return child.type === 'type'
      })
      t.ok(type_node, 'should have type node')
      t.equal(type_node.value, 'feat', 'type should be feat')
    })

    t.test('scope', async (t) => {
      const scope_node = header.children.find((child) => {
        return child.type === 'scope'
      })
      t.ok(scope_node, 'should have scope node')
      t.equal(scope_node.value, 'test', 'scope should be test')
    })

    t.test('bang indicator', async (t) => {
      const bang_node = header.children.find((child) => {
        return child.type === 'bang'
      })
      t.ok(bang_node, 'should have bang node due to !')
    })

    t.test('description', async (t) => {
      const description_node = header.children.find((child) => {
        return child.type === 'description'
      })
      t.ok(description_node, 'should have description node')
    })
  })

  testCase(t, {
    category: 'body'
  , description: 'body section parsing'
  }, async (t) => {
    const result = parser.parse(PROBLEMATIC_COMMIT)

    const body = result.children.find((child) => {
      return child.type === 'body'
    })
    t.ok(body, 'should have body section')
    t.ok(Array.isArray(body.children), 'body should have children')
    t.ok(body.children.length > 0, 'body should have content')

    // Extract full body text - body has line nodes, each with text children
    const body_text = body.children.map(extract_text).join('\n')

    // Should include all body content, not just the first line
    const has_first_line = body_text.includes('This is a body with some content')
    t.ok(has_first_line, 'should include first line')

    const has_breaking_line = body_text.includes(
      'BREAKING CHANGE in body is not a footer'
    )
    t.ok(has_breaking_line, 'should include BREAKING CHANGE line')

    t.ok(
      body_text.includes('It\'s just text in the body'),
      'should include last line'
    )
  })

  testCase(t, {
    category: 'footer'
  , description: 'footer section parsing'
  }, async (t) => {
    const result = parser.parse(PROBLEMATIC_COMMIT)

    const footer = result.children.find((child) => {
      return child.type === 'footer'
    })
    t.ok(footer, 'should have footer section')
    t.ok(Array.isArray(footer.children), 'footer should have children')
    t.ok(footer.children.length > 0, 'footer should have trailers')

    // Should have Footer: yes trailer
    const trailer = footer.children[0]
    t.equal(trailer.type, 'trailer', 'should have trailer')
    t.equal(trailer.breaking, false, 'Footer trailer should not be breaking')
  })

  testCase(t, {
    category: 'chunking'
  , description: 'keywords found in body'
  }, async (t) => {
    const result = parser.parse(PROBLEMATIC_COMMIT)

    const body = result.children.find((child) => {
      return child.type === 'body'
    })
    const footer = result.children.find((child) => {
      return child.type === 'footer'
    })

    t.ok(body, 'should have body')
    t.ok(footer, 'should have footer')

    const body_text = body.children.map(extract_text).join('\n')
    t.ok(
      body_text.includes('BREAKING CHANGE')
    , 'body should contain BREAKING CHANGE text'
    )

    t.type(footer.children, Array, 'footer.children is array')
    t.equal(footer.children.length, 1, 'one trailer found')

    const trailer = footer.children[0]
    t.match(trailer, {
      type: 'trailer'
    , breaking: false
    , children: [{
        type: 'trailerkey'
      , children: [{
          type: 'text'
        , value: 'Footer'
        , position: {
            start: {line: 8, column: 1, offset: 170}
          , end: {line: 8, column: 7, offset: 176}
          }
        }]
      , position: {
          start: {line: 8, column: 1, offset: 170}
        , end: {line: 8, column: 7, offset: 176}
        }
      }, {
        type: 'trailervalue'
      , children: [{
          type: 'text'
        , value: 'yes'
        , position: {
            start: {line: 8, column: 9, offset: 178}
          , end: {line: 8, column: 12, offset: 181}
          }
        }]
      , position: {
          start: {line: 8, column: 9, offset: 178}
        , end: {line: 8, column: 12, offset: 181}
        }
      }]
    , position: {
        start: {line: 8, column: 1, offset: 170}
      , end: {line: 8, column: 12, offset: 181}
      }
    })

    // Footer should contain "Footer: yes"
    const footer_has_correct_trailer = footer.children.some((trailer) => {
      const key_node = trailer.children.find((child) => {
        return child.type === 'trailerkey'
      })
      const value_node = trailer.children.find((child) => {
        return child.type === 'trailervalue'
      })
      return key_node && value_node
        && key_node.children.some((child) => {
        return child.value === 'Footer'
      })
        && value_node.children.some((child) => {
        return child.value === 'yes'
      })
    })
    t.ok(footer_has_correct_trailer, 'footer should have Footer: yes trailer')
  })
})

test('simpler test cases for debugging', async (t) => {
  t.test('simple commit', async (t) => {
    const simple = 'feat: add feature'
    const result = parser.parse(simple)

    t.equal(result.type, 'root', 'root type')
    t.equal(result.children.length, 1, 'should have only header')
    t.equal(result.children[0].type, 'header', 'should be header')
  })

  t.test('commit with body only', async (t) => {
    const with_body = `feat: add feature

This is the body content.`

    const result = parser.parse(with_body)

    t.equal(result.type, 'root', 'root type')
    t.equal(result.children.length, 2, 'should have header and body')

    const body = result.children.find((child) => {
      return child.type === 'body'
    })
    t.ok(body, 'should have body')
  })

  t.test('commit with footer only', async (t) => {
    const with_footer = `feat: add feature

Footer: value`

    const result = parser.parse(with_footer)

    t.equal(result.type, 'root', 'root type')

    // Should have header and footer
    const header = result.children.find((child) => {
      return child.type === 'header'
    })
    const footer = result.children.find((child) => {
      return child.type === 'footer'
    })

    t.ok(header, 'should have header')
    t.ok(footer, 'should have footer')
  })
})
