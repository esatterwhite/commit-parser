'use strict'

const {u: unist} = require('unist-builder')
const {spanPosition} = require('../position.js')

module.exports = description

/**
 * Create a Description node
 * @param {object} props - Node properties
 * @param {boolean} [props.breaking=false] - Whether this is a breaking change
 * @param {string} [props.value=''] - The description text value
 * @param {object} [props.position] - Position information
 * @param {Array} [children=[]] - Text content nodes
 * @returns {object} Description node
 */
function description(props = {}, children = []) {
  const {breaking = false, value = '', position} = props
  return unist('description', {
    breaking
  , value
  , position: position || spanPosition(children)
  }, children)
}

