/*!
 * ENDER - The open module JavaScript framework
 *
 * Copyright (c) 2011-2012 @ded, @fat, @rvagg and other contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is furnished
 * to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

var DependencyGraph = require('ender-dependency-graph')
  , extend          = require('util')._extend
  , write           = require('./write')
  , SourceBuild     = require('./source-build')
  , SourcePackage   = require('./source-package')

  , build = function (options, packages, dependencyGraph, callback) {
          // new SourceBuild object to store each package in
      var srcBuild          = SourceBuild.create(options)
          // sanitise and localise the names from relative paths
        , localizedPackages = dependencyGraph.localizePackageList(packages)
        , rootPackageName   = DependencyGraph.getClientPackageName(options)

      // DependencyGraph does all the hard work of collecting and ordering dependencies for us
      dependencyGraph.forEachUniqueOrderedDependency(localizedPackages, function (packageName, parents, data) {
        var pidx   = localizedPackages.indexOf(packageName)
          , isRoot = (pidx != -1 && packages[pidx] == rootPackageName) || packageName == rootPackageName

        // each package that we need, add it to SourceBuild as a SourcePackage object
        srcBuild.addPackage(SourcePackage.create(packageName, parents, isRoot, data.packageJSON, options))
      })

      // write the output files!
      write.write(options, srcBuild, callback)
    }

module.exports        = build
module.exports.minify = require('./minify').minify
extend(module.exports, require('./errors'))