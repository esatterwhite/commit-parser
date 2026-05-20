'use strict'

const {u: unist} = require('unist-builder')
const {spanPosition} = require('../position.js')

module.exports = trailerValue

/**
 * Create a TrailerValue node
 * @param {object} props - Node properties
 * @param {object} [props.position] - Position information
 * @param {Array} [children=[]] - Text content nodes
 * @returns {object} TrailerValue node
 */
function trailerValue(props = {}, children = []) {
  const {position} = props
  return unist('trailervalue', {
    position: position || spanPosition(children)
  }, children)
}

