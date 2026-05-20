'use strict'

const {u: unist} = require('unist-builder')
const {spanPosition} = require('../position.js')

module.exports = body

/**
 * Create a Body node
 * @param {object} props - Node properties
 * @param {object} [props.position] - Position information
 * @param {Array} [children=[]] - Body content nodes
 * @returns {object} Body node
 */
function body(props = {}, children = []) {
  const {position} = props
  return unist('body', {
    position: position || spanPosition(children)
  }, children)
}

