'use strict'

const {u: unist} = require('unist-builder')

module.exports = scope

/**
 * Create a Scope node
 * @param {object} props - Node properties
 * @param {string} props.value - Scope value
 * @param {object} [props.position] - Position information
 * @returns {object} Scope node
 */
function scope(props = {}) {
  return unist('scope', props)
}

