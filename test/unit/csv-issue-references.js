'use strict'

/**
 * @module test/unit/csv-issue-references
 * @description Test CSV-style comma-separated issue references in footer values
 */

const {test} = require('tap')
const {parse} = require('../../index.js')

test('CSV-style comma-separated issue references', async (t) => {
  t.test('should parse CSV list of issue references', async (t) => {
    const commit = `feat: add feature

Fixes: #1, #2, #3`

    const result = parse(commit)

    t.ok(result, 'should return result')
    t.equal(result.type, 'root', 'root node type')
    t.ok(result.children, 'should have children')

    const footer = result.children.find((child) => {
      return child.type === 'footer'
    })
    t.ok(footer, 'should have footer')
    t.ok(footer.children, 'footer should have children')
    t.equal(footer.children.length, 1, 'should have one trailer')

    const trailer = footer.children[0]
    t.equal(trailer.type, 'trailer', 'should be trailer')

    const trailer_value = trailer.children.find((child) => {
      return child.type === 'trailervalue'
    })
    t.ok(trailer_value, 'should have trailervalue')
    t.ok(trailer_value.children, 'trailervalue should have children')
    t.equal(trailer_value.children.length, 3, 'should have three issue references')

    // Verify all children are issue references
    const issue_refs = trailer_value.children.filter((child) => {
      return child.type === 'issuererence'
    })
    t.equal(issue_refs.length, 3, 'should have three issue references')
    t.equal(issue_refs[0].value, '#1', 'first issue reference')
    t.equal(issue_refs[1].value, '#2', 'second issue reference')
    t.equal(issue_refs[2].value, '#3', 'third issue reference')

    // Verify no text nodes (commas and whitespace should be omitted)
    const text_nodes = trailer_value.children.filter((child) => {
      return child.type === 'text'
    })
    t.equal(text_nodes.length, 0, 'should have no text nodes')
  })

  t.test('should parse single issue reference', async (t) => {
    const commit = `feat: add feature

Fixes: #100`

    const result = parse(commit)

    t.ok(result, 'should return result')
    t.equal(result.type, 'root', 'root node type')

    const footer = result.children.find((child) => {
      return child.type === 'footer'
    })
    t.ok(footer, 'should have footer')

    const trailer = footer.children[0]
    t.equal(trailer.type, 'trailer', 'should be trailer')

    const trailer_value = trailer.children.find((child) => {
      return child.type === 'trailervalue'
    })
    t.ok(trailer_value, 'should have trailervalue')
    t.equal(trailer_value.children.length, 1, 'should have one child')

    const issue_ref = trailer_value.children[0]
    t.equal(issue_ref.type, 'issuererence', 'should be issue reference')
    t.equal(issue_ref.value, '#100', 'issue reference value')
  })

  t.test('should parse mixed text and issue references', async (t) => {
    const commit = `feat: add feature

Random: some text and #200 more text`

    const result = parse(commit)

    t.ok(result, 'should return result')
    t.equal(result.type, 'root', 'root node type')

    const footer = result.children.find((child) => {
      return child.type === 'footer'
    })
    t.ok(footer, 'should have footer')

    const trailer = footer.children[0]
    t.equal(trailer.type, 'trailer', 'should be trailer')

    const trailer_value = trailer.children.find((child) => {
      return child.type === 'trailervalue'
    })
    t.ok(trailer_value, 'should have trailervalue')
    t.equal(trailer_value.children.length, 3, 'should have three children')

    // Verify structure: [text, issuererence, text]
    t.equal(trailer_value.children[0].type, 'text', 'first child is text')
    t.equal(trailer_value.children[0].value, 'some text and', 'first text value')

    t.equal(
      trailer_value.children[1].type
    , 'issuererence'
    , 'second child is issue reference'
    )
    t.equal(trailer_value.children[1].value, '#200', 'issue reference value')

    t.equal(trailer_value.children[2].type, 'text', 'third child is text')
    t.equal(trailer_value.children[2].value, 'more text', 'second text value')
  })

  t.test('should parse CSV list with spaces around commas', async (t) => {
    const commit = `feat: add feature

Fixes: #10 , #20 , #30`

    const result = parse(commit)

    const footer = result.children.find((child) => {
      return child.type === 'footer'
    })
    const trailer = footer.children[0]
    const trailer_value = trailer.children.find((child) => {
      return child.type === 'trailervalue'
    })

    t.equal(trailer_value.children.length, 3, 'should have three issue references')

    const issue_refs = trailer_value.children.filter((child) => {
      return child.type === 'issuererence'
    })
    t.equal(issue_refs.length, 3, 'should have three issue references')
    t.equal(issue_refs[0].value, '#10', 'first issue reference')
    t.equal(issue_refs[1].value, '#20', 'second issue reference')
    t.equal(issue_refs[2].value, '#30', 'third issue reference')

    // Verify no text nodes
    const text_nodes = trailer_value.children.filter((child) => {
      return child.type === 'text'
    })
    t.equal(text_nodes.length, 0, 'should have no text nodes')
  })

  t.test('should parse CSV list without spaces', async (t) => {
    const commit = `feat: add feature

Fixes: #5,#6,#7`

    const result = parse(commit)

    const footer = result.children.find((child) => {
      return child.type === 'footer'
    })
    const trailer = footer.children[0]
    const trailer_value = trailer.children.find((child) => {
      return child.type === 'trailervalue'
    })

    t.equal(trailer_value.children.length, 3, 'should have three issue references')

    const issue_refs = trailer_value.children.filter((child) => {
      return child.type === 'issuererence'
    })
    t.equal(issue_refs.length, 3, 'should have three issue references')
    t.equal(issue_refs[0].value, '#5', 'first issue reference')
    t.equal(issue_refs[1].value, '#6', 'second issue reference')
    t.equal(issue_refs[2].value, '#7', 'third issue reference')
  })

  t.test('should handle text with commas and issue references', async (t) => {
    const commit = `feat: add feature

Fixes: item 1, item 2, and #100`

    const result = parse(commit)

    const footer = result.children.find((child) => {
      return child.type === 'footer'
    })
    const trailer = footer.children[0]
    const trailer_value = trailer.children.find((child) => {
      return child.type === 'trailervalue'
    })

    // Should have text and issue reference
    t.ok(trailer_value.children.length >= 2, 'should have at least two children')

    const issue_refs = trailer_value.children.filter((child) => {
      return child.type === 'issuererence'
    })
    t.equal(issue_refs.length, 1, 'should have one issue reference')
    t.equal(issue_refs[0].value, '#100', 'issue reference value')

    const text_nodes = trailer_value.children.filter((child) => {
      return child.type === 'text'
    })
    t.ok(text_nodes.length >= 1, 'should have at least one text node')
    t.ok(text_nodes[0].value.includes('item'), 'text should contain "item"')
  })

  t.test('should parse multiple trailers with CSV issue references', async (t) => {
    const commit = `feat: add feature

Fixes: #1, #2, #3
Resolves: #10, #20`

    const result = parse(commit)

    const footer = result.children.find((child) => {
      return child.type === 'footer'
    })
    t.equal(footer.children.length, 2, 'should have two trailers')

    // First trailer: Fixes
    const fixes_trailer = footer.children[0]
    const fixes_value = fixes_trailer.children.find((child) => {
      return child.type === 'trailervalue'
    })
    const fixes_refs = fixes_value.children.filter((child) => {
      return child.type === 'issuererence'
    })
    t.equal(fixes_refs.length, 3, 'Fixes should have three issue references')

    // Second trailer: Resolves
    const resolves_trailer = footer.children[1]
    const resolves_value = resolves_trailer.children.find((child) => {
      return child.type === 'trailervalue'
    })
    const resolves_refs = resolves_value.children.filter((child) => {
      return child.type === 'issuererence'
    })
    t.equal(resolves_refs.length, 2, 'Resolves should have two issue references')
  })

  t.test('should omit commas from mixed text and issue references', async (t) => {
    const commit = `feat!: test

Fixes: #1, and nothing, #2, and something else`

    const result = parse(commit)

    const footer = result.children.find((child) => {
      return child.type === 'footer'
    })
    t.ok(footer, 'should have footer')

    const trailer = footer.children[0]
    const trailer_value = trailer.children.find((child) => {
      return child.type === 'trailervalue'
    })

    // Should have: issueRef, text, issueRef, text
    t.equal(trailer_value.children.length, 4, 'should have four children')

    // First issue reference
    t.equal(trailer_value.children[0].type, 'issuererence', 'first child is issue')
    t.equal(trailer_value.children[0].value, '#1', 'first issue is #1')

    // First text node - should NOT contain commas
    t.equal(trailer_value.children[1].type, 'text', 'second child is text')
    t.equal(
      trailer_value.children[1].value
    , 'and nothing'
    , 'first text should be "and nothing" without commas'
    )
    t.notOk(
      trailer_value.children[1].value.includes(',')
    , 'first text should not contain commas'
    )

    // Second issue reference
    t.equal(trailer_value.children[2].type, 'issuererence', 'third child is issue')
    t.equal(trailer_value.children[2].value, '#2', 'second issue is #2')

    // Second text node - should NOT contain commas
    t.equal(trailer_value.children[3].type, 'text', 'fourth child is text')
    t.equal(
      trailer_value.children[3].value
    , 'and something else'
    , 'second text should be "and something else" without commas'
    )
    t.notOk(
      trailer_value.children[3].value.includes(',')
    , 'second text should not contain commas'
    )
  })
})

