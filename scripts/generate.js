#!/bin/env node
'use strict'

/**
 * @file scripts/generate-railroad-diagrams.js
 * @description Generate syntax diagrams (railroad diagrams) for the conventional commit parser
 *
 * Usage:
 * - npm install (to install dependencies)
 * - node scripts/generate-railroad-diagrams.js
 * - open the "conventional-commit-grammar-diagrams.html" file in your browser
 */

const path = require('path')
const fs = require('fs')
const {createSyntaxDiagramsCode} = require('chevrotain')
const {ConventionalCommitParser} = require('../lib/parser.js')

/**
 * Generate HTML file with railroad diagrams for the conventional commit grammar
 */
try {
  // Create parser instance to extract grammar
  const parser_instance = new ConventionalCommitParser()

  // Extract the serialized grammar from the parser
  const serialized_grammar = parser_instance.getSerializedGastProductions()

  console.log('📊 Found grammar rules:', serialized_grammar.map((rule) => {
    return rule.name
  }).join(', '))

  // Create the HTML content with syntax diagrams
  const html_content = createSyntaxDiagramsCode(serialized_grammar)

  // Add custom styling and title

  // Write the HTML file to disk
  const output_path = path.resolve(__dirname, '../diagram.html')
  fs.writeFileSync(output_path, html_content)

  console.log('✅ Railroad diagrams generated successfully!')
  console.log(`📁 Output file: ${output_path}`)
  console.log('🌐 Open the HTML file in your browser to view the diagrams')

  return output_path
} catch (error) {
  console.error('❌ Error generating railroad diagrams:', error)
  process.exit(1)
}

