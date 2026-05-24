'use strict'

const {u: unist} = require('unist-builder')

module.exports = issuererence

/**
 * Create an IssueReference node
 * @param {object} props - Node properties
 * @param {string} props.value - Full reference text (e.g., "#123")
 * @param {string} props.prefix - Reference prefix (e.g., "#", "GH-")
 * @param {number} props.id - Issue/PR number
 * @param {object} [props.position] - Position information
 * @returns {object} IssueReference node
 */
function issuererence(props = {}, children) {
  return unist('issuererence', props, children)
}

