'use strict'

const {u: unist} = require('unist-builder')
const {spanPosition} = require('../position.js')

module.exports = trailerKey

/**
 * Create a TrailerKey node
 * @param {object} props - Node properties
 * @param {object} [props.position] - Position information
 * @param {Array} [children=[]] - Text content nodes
 * @returns {object} TrailerKey node
 */
function trailerKey(props = {}, children = []) {
  const {position} = props
  return unist('trailerkey', {
    position: position || spanPosition(children)
  }, children)
}

