'use strict'

const {u: unist} = require('unist-builder')
const {spanPosition} = require('../position.js')

module.exports = line

/**
 * Create a Line node
 * @param {object} props - Node properties
 * @param {object} [props.position] - Position information
 * @param {Array} [children=[]] - Text content nodes
 * @returns {object} Line node
 */
function line(props = {}, children = []) {
  const {position} = props
  return unist('line', {
    position: position || spanPosition(children)
  }, children)
}

