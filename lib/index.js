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

var async           = require('async')
  , fs              = require('fs')
  , extend          = require('util')._extend

  , assemble        = require('./assemble')
  , minify          = require('./minify')
  , FilesystemError = require('./errors').FilesystemError

  , build = function (options, packages, callback) {
      var name = (options.output || 'ender').replace(/\.js$/, '')
        , outputs = {
              build: name + '.js'
            , sourceMap: name + '.js.map'
            , minifiedBuild: name + '.min.js'
          }

        , writeFiles = function (results, callback) {
            var tasks = Object.keys(results).map(function (key) {
                  return fs.writeFile.bind(null, outputs[key], results[key], 'utf-8')
                })

            async.parallel(tasks, function (err) {
              if (err) return callback(new FilesystemError(err))
              callback(null)
            })
          }

        , minifyBuild = function (results, callback) {
            if (options.minifier == 'none') return callback(null, results)

            var extendedOptions = extend({}, options)
            packages.forEach(function (pkg) { pkg.extendOptions(extendedOptions) })

            minify.minify(extendedOptions, results.build, function (err, minifiedBuild) {
              if (err) return callback(err) // wrapped in minify.js
              results.minifiedBuild = minifiedBuild
              callback(null, results)
            })
          }

        , assembleBuild = function (callback) {
            assemble.assemble(outputs.build, outputs.sourceMap, options, packages, callback)
          }

        , loadSources = function (callback) {
            async.each(packages, function (pkg, callback) { pkg.loadSources(callback) }, callback)
          }

      async.waterfall([
          loadSources
        , assembleBuild
        , minifyBuild
        , writeFiles
      ], function (err) {
        if (err) return callback(err)
        callback(null, outputs.build)
      })
    }

module.exports        = build
module.exports.minify = require('./minify').minify
