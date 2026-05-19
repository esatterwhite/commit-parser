'use strict'

const fs = require('node:fs')
const path = require('node:path')
const {test} = require('tap')
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
    t.ok(Array.isArray(result.children), 'should have children array')
    t.equal(result.children.length, 3, 'should have header, body, and footer')
  })

  t.test('should include header section', async (t) => {
    const result = parser.parse(COMMIT)

    const header = result.children.find((child) => {
      return child.type === 'header'
    })
    t.ok(header, 'should have header section')
    t.ok(Array.isArray(header.children), 'header should have children')

    // Check for type
    const type_node = header.children.find((child) => {
      return child.type === 'type'
    })
    t.ok(type_node, 'should have type node')
    t.equal(type_node.value, 'feat', 'type should be feat')

    // Check for bang indicator
    const bang_node = header.children.find((child) => {
      return child.type === 'bang'
    })
    t.ok(bang_node, 'should have bang node due to !')

    // Check for description
    const description_node = header.children.find((child) => {
      return child.type === 'description'
    })
    t.ok(description_node, 'should have description node')
    t.equal(description_node.value, 'test', 'description should be test')
  })

  t.test('should include body section with all free-form content', async (t) => {
    const result = parser.parse(COMMIT)

    const body = result.children.find((child) => {
      return child.type === 'body'
    })
    t.ok(body, 'should have body section')
    t.ok(Array.isArray(body.children), 'body should have children')
    t.ok(body.children.length > 0, 'body should have content')

    // Extract full body text - body has line nodes, each with text children
    function extract_text(node) {
      if (node.type === 'text') {
        return node.value
      }
      if (node.type === 'issueReference') {
        return node.value
      }
      if (node.children) {
        return node.children.map(extract_text).join('')
      }
      return ''
    }
    const body_text = body.children.map(extract_text).join('\n').trim()

    // The body should contain all these lines with special characters:
    // - "one(four): test" - contains parentheses and colon
    // - "two: #100" - contains colon and hash
    // - "three!" - contains exclamation mark

    t.ok(
      body_text.includes('one(four): test'),
      'should include line with parentheses and colon'
    )
    t.ok(
      body_text.includes('two: #100'),
      'should include line with colon and hash'
    )
    t.ok(
      body_text.includes('three!'),
      'should include line with exclamation mark'
    )

    // Verify the body has 4 line nodes (3 content + 1 blank)
    const line_nodes = body.children.filter((child) => {
      return child.type === 'line'
    })
    t.equal(
      line_nodes.length,
      4,
      'should have 4 line nodes in body (including blank line)'
    )
  })

  t.test('should include footer section', async (t) => {
    const result = parser.parse(COMMIT)

    const footer = result.children.find((child) => {
      return child.type === 'footer'
    })
    t.ok(footer, 'should have footer section')
    t.ok(Array.isArray(footer.children), 'footer should have children')
    t.equal(footer.children.length, 2, 'footer should have 2 trailers')

    // First trailer: BREAKING CHANGE
    const breaking_trailer = footer.children[0]
    t.equal(breaking_trailer.type, 'trailer', 'should have trailer')
    t.equal(breaking_trailer.breaking, true, 'BREAKING CHANGE should be breaking')

    const breaking_key = breaking_trailer.children.find((child) => {
      return child.type === 'trailerkey'
    })
    t.ok(breaking_key, 'should have trailerkey for BREAKING CHANGE')

    const breaking_value = breaking_trailer.children.find((child) => {
      return child.type === 'trailervalue'
    })
    t.ok(breaking_value, 'should have trailervalue for BREAKING CHANGE')

    // Extract text from trailervalue
    function extract_text(node) {
      if (node.type === 'text') {
        return node.value
      }
      if (node.type === 'issueReference') {
        return node.value
      }
      if (node.children) {
        return node.children.map(extract_text).join('')
      }
      return ''
    }
    const breaking_value_text = extract_text(breaking_value).trim()
    t.equal(
      breaking_value_text,
      'this is a breaking change',
      'BREAKING CHANGE value should match'
    )

    // Second trailer: Fixes
    const fixes_trailer = footer.children[1]
    t.equal(fixes_trailer.type, 'trailer', 'should have Fixes trailer')
    t.equal(fixes_trailer.breaking, false, 'Fixes should not be breaking')

    const fixes_key = fixes_trailer.children.find((child) => {
      return child.type === 'trailerkey'
    })
    t.ok(fixes_key, 'should have trailerkey for Fixes')

    const fixes_value = fixes_trailer.children.find((child) => {
      return child.type === 'trailervalue'
    })
    t.ok(fixes_value, 'should have trailervalue for Fixes')

    // Check for issue reference in Fixes value
    const has_issue_ref = fixes_value.children.some((child) => {
      return child.type === 'issueReference'
    })
    t.ok(has_issue_ref, 'Fixes value should have issue reference')
  })

  t.test('should correctly separate body and footer', async (t) => {
    const result = parser.parse(COMMIT)

    const body = result.children.find((child) => {
      return child.type === 'body'
    })
    const footer = result.children.find((child) => {
      return child.type === 'footer'
    })

    t.ok(body, 'should have body')
    t.ok(footer, 'should have footer')

    // Extract body text
    function extract_text(node) {
      if (node.type === 'text') {
        return node.value
      }
      if (node.children) {
        return node.children.map(extract_text).join('')
      }
      return ''
    }
    const body_text = body.children.map(extract_text).join('\n').trim()

    // Body should NOT contain footer content
    t.notOk(
      body_text.includes('BREAKING CHANGE:'),
      'body should not contain footer trailers'
    )
    t.notOk(
      body_text.includes('Fixes:'),
      'body should not contain Fixes trailer'
    )

    // Footer should have the trailers
    const has_breaking = footer.children.some((trailer) => {
      return trailer.breaking === true
    })
    t.ok(has_breaking, 'footer should have BREAKING CHANGE trailer')

    const has_fixes = footer.children.some((trailer) => {
      const key_node = trailer.children.find((child) => {
        return child.type === 'trailerkey'
      })
      if (!key_node) return false
      return key_node.children.some((child) => {
        return child.value === 'Fixes'
      })
    })
    t.ok(has_fixes, 'footer should have Fixes trailer')
  })
})

