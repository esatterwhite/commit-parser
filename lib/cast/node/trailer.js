'use strict'

const {u: unist} = require('unist-builder')
const {spanPosition} = require('../position.js')

module.exports = trailer

/**
 * Create a Trailer node
 * @param {object} props - Node properties
 * @param {boolean} [props.breaking=false] - Whether this is a breaking change trailer
 * @param {object} [props.position] - Position information
 * @param {Array} [children=[]] - Trailer content (token and value)
 * @returns {object} Trailer node
 */
function trailer({breaking = false, position} = {}, children = []) {
  return unist('trailer', {
    breaking: breaking
  , position: position || spanPosition(children)
  }, children)
}

