'use strict'

const {u: unist} = require('unist-builder')
const {spanPosition} = require('../position.js')

module.exports = root

/**
 * Create a Root node
 * @param {object} props - Node properties
 * @param {boolean} [props.breaking=false] - Whether commit contains breaking changes
 * @param {object} [props.position] - Position information
 * @param {Array} [children=[]] - Child nodes
 * @returns {object} Root node
 */
function root(props = {}, children = []) {
  const {breaking = false, position} = props
  return unist('root', {
    breaking
  , position: position || spanPosition(children)
  }, children)
}

