'use strict'

const {u: unist} = require('unist-builder')

module.exports = text

/**
 * Create a Text node
 * @param {object} props - Node properties (value, position)
 * @param {string} props.value - Text value
 * @param {object} [props.position] - Position information
 * @returns {object} Text node
 */
function text(props = {}) {
  return unist('text', props)
}

