'use strict'

/**
 * @module lib/cast/node
 * @description Factory functions for creating CAST AST nodes
 */

module.exports = {
  bang: require('./bang.js')
, body: require('./body.js')
, description: require('./description.js')
, footer: require('./footer.js')
, header: require('./header.js')
, issuereference: require('./issue-ref.js')
, line: require('./line.js')
, mention: require('./mention.js')
, root: require('./root.js')
, scope: require('./scope.js')
, text: require('./text.js')
, trailer: require('./trailer.js')
, trailerKey: require('./trailer-key.js')
, trailerValue: require('./trailer-value.js')
, type: require('./type.js')
}

