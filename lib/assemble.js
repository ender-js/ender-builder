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


/******************************************************************************
 * An interface to UglifyJS. Preserves copyright comments, which UglifyJS
 * currently doesn't do: https://github.com/mishoo/UglifyJS/issues/85
 */

var argsParser    = require('ender-args-parser')
  , async         = require('async')
  , fs            = require('fs')
  , mu            = require('mu2')
  , path          = require('path')

  , vlq           = require('./vlq')
  , TemplateError = require('./errors').TemplateError

  , indentLines = function (str, spaces) {
      return str && str.replace(/^/mg, Array(spaces+1).join(' '))
    }

  , assemble = function (buildName, sourceMapName, options, packages, callback) {
      var templateData = {
              buildName: buildName
            , sourceMapName: sourceMapName
            , context: argsParser.toContextString(options)
            , packageList: []
            , packages: []
          }

        , sourceIndex = 0
        , sourceLine = 0
        , sourceColumn = 0
        , sourceNames = []
        , generateMappings = function (name, content, indent, inline) {
            if (sourceNames.indexOf(name) == -1) sourceNames.push(name)

            return content.replace(/^.*\n/mg, function (line, offset) {
              var firstLine = !offset
                , sourceIndexDelta = (firstLine ? sourceNames.indexOf(name) - sourceIndex : 0)
                , sourceLineDelta = (firstLine ? -sourceLine : 1)
                , sourceColumnDelta = -sourceColumn

              sourceIndex += sourceIndexDelta
              sourceLine += sourceLineDelta
              sourceColumn = line.length

              // VLQ shorthand: A=0, C=1
              return (
                'A' + vlq.encode(sourceIndexDelta)                                         // Set the source index
                    + vlq.encode(sourceLineDelta)                                          // Reset the source line
                    +  vlq.encode(sourceColumnDelta) + ',' +                               // Reset the source column
                vlq.encode(indent || 0) + 'AAA,' +                                         // Map the start of the line
                vlq.encode(line.length) + 'AA' + vlq.encode(line.length) + ';'             // Map the end of the line
              )
            })
          }

      packages.forEach(function (pkg) {
        templateData.packageList.push(pkg.id)

        if (pkg.sources.length) {
          var pkgData = {
                  isBare: pkg.bare || (options['module-lib'] == 'none')
                , isExposed: pkg.bare

                , name: pkg.name
                , main: pkg.main
                , bridge: pkg.bridge
                , sources: []
              }

            , relativeRoot = path.relative('.', pkg.root)

          // do we have a sandboxed build?
          if (options && Array.isArray(options.sandbox)) {
            pkgData.isExposed = (options.sandbox.indexOf(pkg.name) != -1)
          }

          pkg.sources.forEach(function (source, i) {
            var indent = pkg.bare ? 2 : 6
              , indentedContent = indentLines(source.content, indent)

            // don't include the bridge if the package is bare but not exposed
            if (pkg.bare && !pkgData.isExposed && source.name == pkg.bridge) return

            pkgData.sources.push({
                i: i
              , name: source.name
              , content: indentedContent
              , mappings: generateMappings(path.join(relativeRoot, source.name + '.js'), source.content, indent)
            })
          })

          templateData.packages.push(pkgData)
        }
      })

      templateData.packageList = templateData.packageList.join(' ')
      templateData.sourceList = JSON.stringify(sourceNames)

      async.parallel({
          build: function (callback) {
            var source = ''
            mu.compileAndRender('build.mustache', templateData)
              .on('error', function (err) { callback(new TemplateError(err)) })
              .on('data', function (data) { source += data })
              .on('end', function () { callback(null, source) })
          }

        , sourceMap: function (callback) {
            var sourceMap = ''
            mu.compileAndRender('build.map.mustache', templateData)
              .on('error', function (err) { callback(new TemplateError(err)) })
              .on('data', function (data) { sourceMap += data })
              .on('end', function () { callback(null, sourceMap) })
          }
      }, callback)
    }

mu.root = path.join(__dirname, '..', 'resources')

module.exports = {
    assemble: assemble
}