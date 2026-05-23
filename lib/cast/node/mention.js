'use strict'

const {u: unist} = require('unist-builder')

module.exports = mention

function mention(props = {}) {
  return unist('mention', props)
}
