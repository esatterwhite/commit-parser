'use strict'

const {u: unist} = require('unist-builder')
const {spanPosition} = require('../position.js')

module.exports = footer

/**
 * Create a Footer node
 * @param {object} props - Node properties
 * @param {object} [props.position] - Position information
 * @param {Array} [children=[]] - Footer content nodes (trailers)
 * @returns {object} Footer node
 */
function footer(props = {}, children = []) {
  const {position} = props
  return unist('footer', {
    position: position || spanPosition(children)
  }, children)
}

