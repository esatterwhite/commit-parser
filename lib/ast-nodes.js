'use strict'

/**
 * @module lib/ast-nodes
 * @description Factory functions for creating CAST AST nodes
 */

module.exports = {
  // Position utilities
  tokenToPosition
, spanPosition

  // Node factories
, createRoot
, createHeader
, createType
, createScope
, createBang
, createDescription
, createBody
, createFooter
, createTrailer
, createTrailerKey
, createTrailerValue
, createLine
, createText
, createIssueReference

  // Text parsing
, parseTextWithIssues
}

/**
 * Convert Chevrotain token position to unist position
 * @param {object} token - Chevrotain token with startLine, startColumn, etc.
 * @returns {object} Unist position object
 */
function tokenToPosition(token) {
  if (!token) return undefined

  return {
    start: {
      line: token.startLine || 1
    , column: token.startColumn || 1
    , offset: token.startOffset || 0
    }
  , end: {
      line: token.endLine || token.startLine || 1
    , column: (token.endColumn || token.startColumn || 1) + 1 // Convert to exclusive end
    , offset: (token.endOffset || token.startOffset || 0) + 1
    }
  }
}

/**
 * Create position spanning from first to last child
 * @param {Array} children - Array of child nodes with position
 * @returns {object|undefined} Combined position object
 */
function spanPosition(children) {
  if (!children || children.length === 0) return undefined

  const first = children.find((child) => { return child.position })
  const last = children.slice().reverse().find((child) => { return child.position })

  if (!first || !last) return undefined

  return {
    start: first.position.start
  , end: last.position.end
  }
}

/**
 * Create a Root node
 * @param {Array} children - Child nodes
 * @param {boolean} breaking - Whether commit contains breaking changes
 * @param {object} position - Position information
 * @returns {object} Root node
 */
function createRoot(children = [], breaking = false, position) {
  return {
    type: 'root'
  , breaking
  , children
  , position: position || spanPosition(children)
  }
}

/**
 * Create a Header node
 * @param {Array} children - Header content nodes
 * @param {object} position - Position information
 * @returns {object} Header node
 */
function createHeader(children = [], position) {
  return {
    type: 'header'
  , children
  , position: position || spanPosition(children)
  }
}

/**
 * Create a Type node
 * @param {string} value - Type value
 * @param {object} position - Position information
 * @returns {object} Type node
 */
function createType(value, position) {
  return {
    type: 'type'
  , value
  , position
  }
}

/**
 * Create a Scope node
 * @param {string} value - Scope value
 * @param {object} position - Position information
 * @returns {object} Scope node
 */
function createScope(value, position) {
  return {
    type: 'scope'
  , value
  , position
  }
}

/**
 * Create a Bang node
 * @param {object} position - Position information
 * @returns {object} Bang node
 */
function createBang(position) {
  // Create a text node for the '!' character
  const text_node = createText('!', position)

  return {
    type: 'bang'
  , children: [text_node]
  , position
  }
}

/**
 * Create a Description node
 * @param {Array} children - Text content nodes
 * @param {boolean} breaking - Whether this is a breaking change
 * @param {string} value - The description text value
 * @param {object} position - Position information
 * @returns {object} Description node
 */
function createDescription(children = [], breaking = false, value = '', position) {
  return {
    type: 'description'
  , children
  , breaking
  , value
  , position: position || spanPosition(children)
  }
}

/**
 * Create a Body node
 * @param {Array} children - Body content nodes
 * @param {object} position - Position information
 * @returns {object} Body node
 */
function createBody(children = [], position) {
  return {
    type: 'body'
  , children
  , position: position || spanPosition(children)
  }
}

/**
 * Create a Footer node
 * @param {Array} children - Footer content nodes (trailers)
 * @param {object} position - Position information
 * @returns {object} Footer node
 */
function createFooter(children = [], position) {
  return {
    type: 'footer'
  , children
  , position: position || spanPosition(children)
  }
}

/**
 * Create a Trailer node
 * @param {Array} children - Trailer content (token and value)
 * @param {boolean} breaking - Whether this is a breaking change trailer
 * @param {object} position - Position information
 * @returns {object} Trailer node
 */
function createTrailer(children = [], breaking = false, position) {
  return {
    type: 'trailer'
  , children
  , breaking
  , position: position || spanPosition(children)
  }
}

/**
 * Create a TrailerKey node
 * @param {Array} children - Text content nodes
 * @param {object} position - Position information
 * @returns {object} TrailerKey node
 */
function createTrailerKey(children = [], position) {
  return {
    type: 'trailerkey'
  , children
  , position: position || spanPosition(children)
  }
}

/**
 * Create a TrailerValue node
 * @param {Array} children - Text content nodes
 * @param {object} position - Position information
 * @returns {object} TrailerValue node
 */
function createTrailerValue(children = [], position) {
  return {
    type: 'trailervalue'
  , children
  , position: position || spanPosition(children)
  }
}

/**
 * Create a Line node
 * @param {Array} children - Text content nodes
 * @param {object} position - Position information
 * @returns {object} Line node
 */
function createLine(children = [], position) {
  return {
    type: 'line'
  , children
  , position: position || spanPosition(children)
  }
}

/**
 * Create a Text node
 * @param {string} value - Text value
 * @param {object} position - Position information
 * @returns {object} Text node
 */
function createText(value, position) {
  return {
    type: 'text'
  , value
  , position
  }
}

/**
 * Create an IssueReference node
 * @param {string} value - Full reference text (e.g., "#123")
 * @param {string} prefix - Reference prefix (e.g., "#", "GH-")
 * @param {number} id - Issue/PR number
 * @param {object} position - Position information
 * @returns {object} IssueReference node
 */
function createIssueReference(value, prefix, id, position) {
  return {
    type: 'issueReference'
  , value
  , prefix
  , id
  , position
  }
}

// ============================================
// Issue Reference Parsing
// ============================================

/**
 * Parse text and create Text/IssueReference nodes
 * @param {string} text - Text to parse
 * @param {object} basePosition - Base position for calculating offsets
 * @returns {Array} Array of Text and IssueReference nodes
 */
function parseTextWithIssues(text, basePosition) {
  const nodes = []
  const issuePattern = /(#|GH-|gh-)(\d+)/g
  let lastIndex = 0
  let match

  while ((match = issuePattern.exec(text)) !== null) {
    const matchStart = match.index
    const matchEnd = match.index + match[0].length

    // Add text before the issue reference
    if (matchStart > lastIndex) {
      const textValue = text.substring(lastIndex, matchStart)
      const textPosition = basePosition ? {
        start: {
          line: basePosition.start.line
        , column: basePosition.start.column + lastIndex
        , offset: basePosition.start.offset + lastIndex
        }
      , end: {
          line: basePosition.start.line
        , column: basePosition.start.column + matchStart
        , offset: basePosition.start.offset + matchStart
        }
      } : undefined

      nodes.push(createText(textValue, textPosition))
    }

    // Add the issue reference
    const issuePosition = basePosition ? {
      start: {
        line: basePosition.start.line
      , column: basePosition.start.column + matchStart
      , offset: basePosition.start.offset + matchStart
      }
    , end: {
        line: basePosition.start.line
      , column: basePosition.start.column + matchEnd
      , offset: basePosition.start.offset + matchEnd
      }
    } : undefined

    nodes.push(createIssueReference(
      match[0],
      match[1],
      parseInt(match[2], 10),
      issuePosition
    ))

    lastIndex = matchEnd
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const textValue = text.substring(lastIndex)
    const textPosition = basePosition ? {
      start: {
        line: basePosition.start.line
      , column: basePosition.start.column + lastIndex
      , offset: basePosition.start.offset + lastIndex
      }
    , end: {
        line: basePosition.start.line
      , column: basePosition.start.column + text.length
      , offset: basePosition.start.offset + text.length
      }
    } : undefined

    nodes.push(createText(textValue, textPosition))
  }

  // If no issues found and no text was added, add the whole text as a single node
  if (nodes.length === 0) {
    nodes.push(createText(text, basePosition))
  }

  return nodes
}
