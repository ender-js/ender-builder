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
 * The SourcePackage object, each instance is associated with an npm package.
 * The object uses the package.json and commandline options to figure out how
 * to assemble an output via the asString() method.
 * Internally we use EJS templates to augment the source to provide an Ender-
 * compatible output (the less screwing with strings here the better).
 */

var fs                = require('fs')
  , path              = require('path')
  , async             = require('async')
  , packageUtil       = require('ender-package-util')
  , sourcePackageUtil = require('./source-package-util')

  , normalizeModuleName = function (moduleName) {
      return moduleName && path.normalize(moduleName).replace(/(\.js)?$/, '')
    }
       
  , getExposedPackageNames = function (options) {
      return (options && Array.isArray(options.sandbox) ? options.sandbox.map(normalizeModuleName) : [])
    }
  
  , SourcePackage = {
        init: function (name, parents, descriptor, options) {
          var exposedPackageNames = getExposedPackageNames(options)
          
          this.name        = name
          this.parents     = parents
          this.descriptor  = descriptor || {}

          this.main = normalizeModuleName(this.descriptor.main) || 'index'
          this.bridge = normalizeModuleName(this.descriptor.ender)

          this.isBare = !!this.descriptor.bare
          this.isExposed = (!options ||
                            !options.sandbox ||
                            exposedPackageNames.indexOf(name) != -1)
          
          // custom hasher function for async.memoize so we have a single key, default will use
          // first arg (callback) as hash key which won't work
          this.loadSources = async.memoize(this.loadSources.bind(this), function () { return '_' })

          return this
        }

        // not the overridden name, the name from the unmodified descriptor
      , get originalName () {
          return this.descriptor &&
                 Object.getPrototypeOf(this.descriptor).name ||
                 this.name
        }

        // the root of this package on the filesystem
      , get root () {
          return sourcePackageUtil.isCWD(this.name)
            ? path.resolve('.')
            : packageUtil.getPackageRoot(this.parents, this.originalName)
        }

        // get the `name` from the original json data, available as proto (see package-descriptor.js)
      , get identifier () {
          return this.originalName + '@' + this.descriptor.version
        }

      , loadSources: function (callback) {
          if (this.sources) return callback(null)
          
          files = this.descriptor.files || []
          if (!Array.isArray(files)) files = [ files ]

          if (this.main) files.push(this.main)
          if (this.bridge) files.push(this.bridge)

          // Make sure everything ends in .js (this might break some rare edge-cases with globs)
          files = files.map(function (file) { return file.replace(/(\.js)?$/, '.js') })
          
          sourcePackageUtil.loadFiles(this.root, files, function (err, results) {
            if (err) return callback(err)
            
            // Add a field for the normalized path
            results.forEach(function (result) { result.name = normalizeModuleName(result.file) })
            this.sources = results
            callback(null)
          }.bind(this))
        }
        
      , extendOptions: function (options) {
          var externs = this.descriptor && this.descriptor.externs
            , root = this.root

          if (externs) {
            if (!Array.isArray(externs)) externs = [ externs ]
            if (!options.externs) options.externs = []
            options.externs = options.externs.concat(externs.map(function (e) {
              return path.join(root, e)
            }))
          }
        }
    }
    
  , create = function (name, parents, descriptor, options) {
      return Object.create(SourcePackage).init(name, parents, descriptor, options)
    }


module.exports = {
    create: create
}