'use strict'

const tap = require('tap')

module.exports = testCase

/**
 * Helper function that sets up a child with a preset format
 * @param {Test} t the test instance.
 * @param {string} opts.category the category to assign this test to (used in display formatting)
 * @param {string} opts.description a description of this test (used in display formatting)
 * @param {boolean} opts.runOnly whether to make this test as only(), so that the harnass will
 *                  limit itself to this test. Useful for Dev, should never be on
 *                  before a commit.
 * @param {Function} cb the testing callback, as would be passed into t.test()
 */
function testCase(t, opts, cb) {
  const method = opts.method || 'test'
  return t[method](`(${opts.category}) ${opts.description}`, cb).catch(tap.threw)
}

