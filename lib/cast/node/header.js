'use strict'

const {u: unist} = require('unist-builder')
const {spanPosition} = require('../position.js')

module.exports = header

/**
 * Create a Header node
 * @param {object} props - Node properties
 * @param {object} [props.position] - Position information
 * @param {Array} [children=[]] - Header content nodes
 * @returns {object} Header node
 */
function header(props = {}, children = []) {
  const {position} = props
  return unist('header', {
    position: position || spanPosition(children)
  }, children)
}

