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

var argsParser      = require('ender-args-parser')
  , fs              = require('fs')
  , path            = require('path')
  , async           = require('async')
  , mu              = require('mu2')
  
  , indent = function (str, spaces) {
      return str && str.replace(/^/mg, Array(spaces+1).join(' '))
    }
  
  , packageTemplateData = function (srcPackage) {
      var templateData = {
            isBare: srcPackage.isBare
          , isExposed: srcPackage.isExposed
          , id: JSON.stringify(srcPackage.name)
          
          , main: JSON.stringify(srcPackage.main)
          , bridge: JSON.stringify(srcPackage.bridge)
        }

      templateData.sources = srcPackage.sources.map(function (source, i) {
        var indentedContents = indent(source.contents, (srcPackage.isBare ? 2 : 6))
        
        if (source.path == srcPackage.main) {
          templateData.mainSource = indentedContents
        } else if (source.path == srcPackage.bridge) {
          templateData.bridgeSource = indentedContents
        }
  
        return { i: i, name: JSON.stringify(source.name), contents: indentedContents }
      })
      
      return templateData
    }
  
  , assemble = function (options, packages, callback) {
      var source = ''
        , templateData = {
              context: argsParser.toContextString(options)
            , packageList: packages.map(function (p) { return p.identifier }).join(' ')
            , packages: packages.map(packageTemplateData)
            , sandbox: !!options.sandbox
          }
    
      mu.compileAndRender('build.mustache', templateData)
        .on('error', function (err) { callback(err) })
        .on('data', function (data) { source += data })
        .on('end', function () { callback(null, source) })
    }

mu.root = path.join(__dirname, '..', 'resources')

module.exports = {
    assemble: assemble
}