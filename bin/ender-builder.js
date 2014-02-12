#!/usr/bin/env node

var argsParser      = require('ender-args-parser')
  , enderPackage    = require('ender-package')
  , repository      = require('ender-repository')
  , builder         = require('../')

  , options         = argsParser.parseClean(['build'].concat(process.argv.slice(2)))

if (!options.packages.length) {
  console.error('Usage: ender-builder <package1>[ <package2>[ <package3> ]]')
  return process.exit(-1)
}

enderPackage.walkDependencies(options.packages, true, true, function (err, packages) {
  if (err) throw err

  builder(options, packages, function (err, filename) {
    if (err) throw err
  })
})
