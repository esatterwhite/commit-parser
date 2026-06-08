'use strict'

const {test} = require('tap')
const {testCase} = require('../common/index.js')
const pkg = require('../../index.js')

test('entrypoint', async (t) => {
  testCase(t, {
    category: 'smoke'
  , description: 'module exports'
  }, async (t) => {
    t.type(pkg.parse, Function, 'exports top level parse function')
    t.type(pkg.cast, 'object', 'export cast module')
    t.equal(
      pkg.CommitParser
    , require('../../lib/commit-parser.js')
    , 'Exports the main commitParser class'
    )
  })
})
