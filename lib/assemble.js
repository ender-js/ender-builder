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
  , TemplateError   = require('./errors').TemplateError
  
  , indent = function (str, spaces) {
      return str && str.replace(/^/mg, Array(spaces+1).join(' '))
    }
  
  , packageTemplateData = function (options, pkg) {
      var templateData = {
              isBare: !!pkg.bare
            , isExposed: (!options ||
                          !options.sandbox ||
                          (Array.isArray(options.sandbox) &&
                           options.sandbox.indexOf(pkg.name) == -1))
                         
            , name: JSON.stringify(pkg.name)
            , main: JSON.stringify(pkg.main)
            , bridge: JSON.stringify(pkg.bridge)
          }
          
        , sourceNames = Object.keys(pkg.sources).sort()

      templateData.sources = sourceNames.map(function (name, i) {
        var indentedContents = indent(pkg.sources[name], (pkg.bare ? 2 : 6))
        
        if (name == pkg.main) {
          templateData.mainSource = indentedContents
        } else if (name == pkg.bridge) {
          templateData.bridgeSource = indentedContents
        }
        
        return {
          comma: (i < sourceNames.length - 1),
          name: JSON.stringify(name),
          contents: indentedContents
        }
      })
      
      return templateData
    }
  
  , assemble = function (options, packages, callback) {
      var source = ''
        , templateData = {
              context: argsParser.toContextString(options)
            , packageList: packages.map(function (pkg) { return pkg.id }).join(' ')
            , packages: packages.filter(function (pkg) { return Object.keys(pkg.sources).length })
                                .map(packageTemplateData.bind(null, options))
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