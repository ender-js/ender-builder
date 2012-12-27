#!/usr/bin/env node

var argsParser      = require('ender-args-parser')
  , DependencyGraph = require('ender-dependency-graph')
  , builder         = require('../')
  , options         = argsParser.parseClean(['build'].concat(process.argv.slice(2)))

if (!options.packages.length) {
  console.error('Usage: ender-builder <package1>[ <package2>[ <package3> ]]')
  return process.exit(-1)
}

DependencyGraph(options, options.packages, function (err, dependencyGraph) {
  if (err) throw err

  if (!options.silent)
    console.log(DependencyGraph.archyTree(options.packages, dependencyGraph, true))

  builder(options, options.packages, dependencyGraph, function (err, filename) {
    if (err) throw err
  })
})