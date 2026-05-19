'use strict'

/**
 * @module lib/ast-utils
 * @description Utilities for working with CAST AST using standard unist utilities
 */

const {visit} = require('unist-util-visit')

// ============================================
// Conventional Commit Specific Utilities
// ============================================

/**
 * Extract all text content from text and issue reference nodes
 * @param {object|Array} nodes - Node or array of nodes
 * @returns {string} Combined text content
 */
function extractText(nodes) {
  if (!nodes) return ''

  const node_array = Array.isArray(nodes) ? nodes : [nodes]
  const text_values = []

  for (const node of node_array) {
    visit(node, ['text', 'issueReference'], (textNode) => {
      text_values.push(textNode.value)
    })
  }

  return text_values.join('')
}

/**
 * Extract all issue references from the AST
 * @param {object} ast - AST root node
 * @returns {Array} Array of issue reference objects
 */
function extractIssues(ast) {
  const issues = []

  visit(ast, 'issueReference', (node) => {
    issues.push({
      issue: node.value
    , prefix: node.prefix
    , id: node.id
    , position: node.position
    })
  })

  return issues
}

/**
 * Extract breaking changes from the AST
 * @param {object} ast - AST root node
 * @returns {Array} Array of breaking change descriptions
 */
function extractBreakingChanges(ast) {
  const breaking_changes = []

  // Find breaking change in header description
  visit(ast, 'description', (description) => {
    if (description.breaking && description.value) {
      breaking_changes.push(description.value)
    }
  })

  // Find breaking change trailers
  visit(ast, 'trailer', (trailer) => {
    if (trailer.breaking) {
      visit(trailer, 'trailervalue', (valueNode) => {
        const text = extractText(valueNode.children)
        breaking_changes.push(text)
      })
    }
  })

  return breaking_changes
}

/**
 * Get commit metadata from AST
 * @param {object} ast - AST root node
 * @returns {object} Metadata object
 */
function getMetadata(ast) {
  let type = null
  let scope = null
  let description = null
  let body = null
  let has_footer = false

  // Extract type
  visit(ast, 'type', (node) => {
    type = node.value
  })

  // Extract scope
  visit(ast, 'scope', (node) => {
    scope = node.value
  })

  // Extract description
  visit(ast, 'description', (node) => {
    description = extractText(node.children)
  })

  // Extract body
  visit(ast, 'body', (node) => {
    body = extractText(node.children)
  })

  // Check for footer
  visit(ast, 'footer', () => {
    has_footer = true
  })

  return {
    type
  , scope
  , breaking: ast.breaking || false
  , description
  , body
  , issues: extractIssues(ast)
  , breakingChanges: extractBreakingChanges(ast)
  , hasFooter: has_footer
  }
}

/**
 * Convert AST back to commit message text
 * @param {object} ast - AST root node
 * @returns {string} Commit message text
 */
function serialize(ast) {
  const parts = []

  // Serialize header
  visit(ast, 'header', (header) => {
    const header_parts = []

    visit(header, 'type', (typeNode) => {
      header_parts.push(typeNode.value)
    })

    visit(header, 'scope', (scopeNode) => {
      header_parts.push(`(${scopeNode.value})`)
    })

    visit(header, 'bang', (bangNode) => {
      header_parts.push(extractText(bangNode.children))
    })

    header_parts.push(':')

    visit(header, 'description', (descNode) => {
      header_parts.push(extractText(descNode.children))
    })

    parts.push(header_parts.join(''))
  })

  // Serialize body
  visit(ast, 'body', (body) => {
    parts.push('')
    // Handle Line nodes - each line should be on its own line
    if (body.children && body.children.length > 0) {
      const lines = body.children.map((line) => {
        return extractText(line.children || line)
      })
      parts.push(lines.join('\n'))
    }
  })

  // Serialize footer
  visit(ast, 'footer', (footer) => {
    parts.push('')

    visit(footer, 'trailer', (trailer) => {
      let token = ''
      let value = ''

      visit(trailer, 'trailerkey', (tokenNode) => {
        token = extractText(tokenNode.children)
      })

      visit(trailer, 'trailervalue', (valueNode) => {
        value = extractText(valueNode.children)
      })

      if (token && value) {
        parts.push(`${token}: ${value}`)
      }
    })
  })

  return parts.join('\n')
}

/**
 * Find the first node of a specific type
 * @param {object} ast - AST root node
 * @param {string} type - Node type to find
 * @returns {object|null} First matching node or null
 */
function findFirst(ast, type) {
  let found = null

  visit(ast, type, (node) => {
    if (!found) {
      found = node
    }
  })

  return found
}

/**
 * Find all nodes of a specific type
 * @param {object} ast - AST root node
 * @param {string} type - Node type to find
 * @returns {Array} Array of matching nodes
 */
function findAll(ast, type) {
  const nodes = []

  visit(ast, type, (node) => {
    nodes.push(node)
  })

  return nodes
}

/**
 * Check if the commit has breaking changes
 * @param {object} ast - AST root node
 * @returns {boolean} True if commit has breaking changes
 */
function hasBreakingChanges(ast) {
  return !!ast.breaking
}

/**
 * Get all trailer tokens and values
 * @param {object} ast - AST root node
 * @returns {object} Object with trailer tokens as keys and values as values
 */
function getTrailers(ast) {
  const trailers = {}

  visit(ast, 'trailer', (trailer) => {
    let token = ''
    let value = ''

    visit(trailer, 'trailerkey', (tokenNode) => {
      token = extractText(tokenNode.children)
    })

    visit(trailer, 'trailervalue', (valueNode) => {
      value = extractText(valueNode.children)
    })

    if (token) {
      trailers[token] = value
    }
  })

  return trailers
}

// ============================================
// Exports
// ============================================

module.exports = {
  // Re-export unist-util-visit for convenience
  visit

  // Domain-specific utilities
, extractText
, extractIssues
, extractBreakingChanges
, getMetadata
, serialize
, findFirst
, findAll
, hasBreakingChanges
, getTrailers
}
