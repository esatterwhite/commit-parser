'use strict'

/**
 * @module lib/chunker
 * @description Pre-processing chunker for splitting commit messages into sections
 */

const {BREAKING_CHANGES} = require('./constants.js')
const TRAILER_REGEX = /^[A-Za-z]+([-][A-Za-z]+)*\s*[:#]\s*.+$/

module.exports = {
  chunkCommitMessage
, isTrailerLine
, adjustTokenPositions
}
/**
 * Represents a chunk of the commit message
 * @typedef {Object} CommitChunk
 * @property {string} type - The type of chunk ('header', 'body', 'footer')
 * @property {string} content - The raw content of the chunk
 * @property {number} start_offset - Start position in original message
 * @property {number} end_offset - End position in original message
 * @property {number} start_line - Start line number in original message
 * @property {number} end_line - End line number in original message
 */

/**
 * Result of chunking a commit message
 * @typedef {Object} ChunkResult
 * @property {CommitChunk} header - Header chunk (always present)
 * @property {CommitChunk|null} body - Body chunk (optional)
 * @property {CommitChunk|null} footer - Footer chunk (optional)
 */

/**
 * Check if a line matches a trailer pattern
 * @param {string} line - Line to check
 * @param {string[]} notes_phrase - Array of breaking change phrases
 * @returns {boolean} True if line matches trailer pattern
 */
function isTrailerLine(line, notes_phrase = ['BREAKING CHANGE']) {
  const trimmed = line.trim()

  if (!trimmed.length) return false
  if (TRAILER_REGEX.test(trimmed)) return true

  // Check for configurable breaking change phrases
  for (const phrase of notes_phrase) {
    const phrase_pattern = phrase.replace(/[\s-]+/g, '[\\s-]+')
    const regex = new RegExp(`^${phrase_pattern}\\s*:\\s*.+$`, 'i')
    if (regex.test(trimmed)) return true
  }

  return false
}

/**
 * Check if a chunk contains only trailer lines
 * @param {string} chunk - Chunk content to check
 * @param {string[]} notes_phrase - Array of breaking change phrases
 * @returns {boolean} True if chunk contains only trailers
 */
function isFooterChunk(chunk, notes_phrase = ['BREAKING CHANGE']) {
  const lines = chunk.split('\n')

  // Must have at least one non-empty line
  const non_empty_lines = lines.filter((line) => {
    return !!line.trim().length
  })

  if (!non_empty_lines.length) return false

  // All non-empty lines must be trailers
  return non_empty_lines.every((line) => {
    return isTrailerLine(line, notes_phrase)
  })
}

/**
 * Calculate line number for a given offset
 * @param {string} text - Full text
 * @param {number} offset - Character offset
 * @returns {number} Line number
 */
function getLineFromOffset(text, offset) {
  return text.substring(0, offset).split('\n').length
}

/**
 * Split commit message into sections using simple double-newline approach
 * @param {string} message - Full commit message
 * @param {Object} config - Configuration options
 * @param {string[]} config.notesPhrase - Array of breaking change phrases
 * @returns {ChunkResult} Chunked sections
 */
function chunkCommitMessage(message, config = {notesPhrase: BREAKING_CHANGES}) {
  const {notesPhrase} = config

  // Normalize line endings: \r\n -> \n
  const normalized = message.replace(/\r\n/g, '\n')

  const chunks = normalized.split('\n\n')

  // Header is always position 0
  const header_content = chunks[0] || ''
  const header_end_offset = header_content.length

  const header_chunk = {
    type: 'header'
  , content: header_content
  , start_offset: 0
  , end_offset: header_end_offset
  , start_line: 1
  , end_line: getLineFromOffset(normalized, header_end_offset)
  }

  // Only header? Return early
  if (chunks.length === 1) {
    return {
      header: header_chunk
    , body: null
    , footer: null
    }
  }

  // Check if last chunk (position length-1) is a footer
  const last_chunk = chunks[chunks.length - 1]
  const has_footer = isFooterChunk(last_chunk, notesPhrase)

  let body_chunk = null
  let footer_chunk = null

  if (has_footer) {
    // Footer is last chunk
    const footer_chunks_before = chunks.slice(0, -1).join('\n\n')
    const footer_start_offset = footer_chunks_before.length + 2 // +2 for '\n\n'
    const footer_end_offset = normalized.length

    footer_chunk = {
      type: 'footer'
    , content: last_chunk
    , start_offset: footer_start_offset
    , end_offset: footer_end_offset
    , start_line: getLineFromOffset(normalized, footer_start_offset)
    , end_line: getLineFromOffset(normalized, footer_end_offset)
    }

    // Body is everything between header and footer
    if (chunks.length > 2) {
      const body_chunks = chunks.slice(1, -1)
      const body_content = body_chunks.join('\n\n')
      const body_start_offset = header_end_offset + 2 // +2 for '\n\n'
      const body_end_offset = body_start_offset + body_content.length

      body_chunk = {
        type: 'body'
      , content: body_content
      , start_offset: body_start_offset
      , end_offset: body_end_offset
      , start_line: getLineFromOffset(normalized, body_start_offset)
      , end_line: getLineFromOffset(normalized, body_end_offset)
      }
    }
  } else {
    // No footer, everything after header is body
    const body_chunks = chunks.slice(1)
    const body_content = body_chunks.join('\n\n')
    const body_start_offset = header_end_offset + 2 // +2 for '\n\n'
    const body_end_offset = normalized.length

    body_chunk = {
      type: 'body'
    , content: body_content
    , start_offset: body_start_offset
    , end_offset: body_end_offset
    , start_line: getLineFromOffset(normalized, body_start_offset)
    , end_line: getLineFromOffset(normalized, body_end_offset)
    }
  }

  return {
    header: header_chunk
  , body: body_chunk
  , footer: footer_chunk
  }
}

/**
 * Adjust token positions to account for chunk position in original message
 * @param {Array} tokens - Array of tokens from lexer
 * @param {CommitChunk} chunk - Chunk information with position data
 * @returns {Array} Tokens with adjusted positions
 */
function adjustTokenPositions(tokens, chunk) {
  return tokens.map((token) => {
    const adjusted_token = {...token}

    // Chevrotain tokens use camelCase properties
    if (token.startOffset !== undefined) {
      adjusted_token.startOffset = token.startOffset + chunk.start_offset
    }
    if (token.endOffset !== undefined) {
      adjusted_token.endOffset = token.endOffset + chunk.start_offset
    }
    if (token.startLine !== undefined) {
      adjusted_token.startLine = token.startLine + chunk.start_line - 1
    }
    if (token.endLine !== undefined) {
      adjusted_token.endLine = token.endLine + chunk.start_line - 1
    }

    return adjusted_token
  })
}

