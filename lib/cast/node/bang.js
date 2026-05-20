'use strict'

const {u: unist} = require('unist-builder')

module.exports = bang

/**
 * Create a Bang node
 * @param {object} props - Node properties
 * @param {object} [props.position] - Position information
 * @returns {object} Bang node
 */
function bang(props = {}) {
  return unist('bang', props, [
    unist('text', {value: '!'})
  ])
}
