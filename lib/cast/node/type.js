'use strict'

const {u: unist} = require('unist-builder')

module.exports = type

/**
 * Create a Type node
 * @param {object} props - Node properties
 * @param {string} props.value - Type value (e.g., 'feat', 'fix')
 * @param {object} [props.position] - Position information
 * @returns {object} Type node
 */
function type(props = {}) {
  return unist('type', props)
}

