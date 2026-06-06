
'use strict'

const path = require('node:path')
const fs = require('node:fs/promises')
const {selectAll} = require('unist-util-select')
const {test} = require('tap')
const {testCase, CommitParser} = require('../../../common/index.js')

test('repo reference parsing', async (t) => {
  const commit = await fs.readFile(path.join(__dirname, 'commit.txt'), 'utf8')

  // If the bug exists:
  // trailer_value çocukları will likely contain an 'issuereference' with a repo name "of"

  testCase(t, {
    category: 'issuerefernce'
  , description: 'parse issues from plain text'
  }, async (t) => {
    const result = CommitParser.parse(commit)
    const issues = selectAll('footer trailer issuereference', result)
    const ref = issues[0]
    t.matchStrict(ref, {
      value: '#100'
    , type: 'issuereference'
    , prefix: '#'
    , id: 100
    , owner: null
    , repository: null
    }, 'issue reference value should be exactly #100')
  })

  testCase(t, {
    category: 'text'
  , description: 'parsed plain text values'
  }, async (t) => {
    const result = CommitParser.parse(commit)
    const texts = selectAll('footer text', result)
    t.match(texts, [{
      value: 'See'
    }, {
      value: 'of'
    }], 'expexted text nodes')
  })
})
