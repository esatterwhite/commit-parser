'use strict'

const fs = require('node:fs')

module.exports = {
  commit: fs.readFileSync('./commit.txt')
}
