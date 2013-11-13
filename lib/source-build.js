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
 * SourceBuild is an object that is created for each Ender build to hold and
 * manage multiple SourcePackage objects. It is able to pull together the
 * source files through its asString() method which in turn invokes asString()
 * on the list of SourcePackages.
 */

var async        = require('async')
  , extend       = require('util')._extend
  , assemble     = require('./assemble')
  , minify       = require('./minify')

  , SourceBuild  = {
        init: function (options, packages) {
          this.options  = options
          this.packages = packages
          return this
        }

      , asString: function (options, callback) {
          //options.type == plain||minified
          var finish = function (err, source) {
                if (err) return callback(err) // wrapped in assemble.js
                if (options.type != 'minified') return callback(null, source)
                minify.minify(this.completeOptions(), source, callback)
              }.bind(this)

            , assembleBuild = function (err, callback) {
                if (err) return callback(err) // wrapped in ender-package
                assemble.assemble(this.options, this.packages, finish)
              }.bind(this)

            , loadSources = function (pkg, callback) {
                pkg.loadSources(callback)
              }
          
          async.each(this.packages, loadSources, assembleBuild)
        }

      , completeOptions: function () { // options + any additional options child packages may wish to add
          var options = extend({}, this.options)
          this.packages.forEach(function (pkg) {
            pkg.extendOptions(options)
          })
          return options
        }
    }

  , create = function (options, packages) {
      return Object.create(SourceBuild).init(options, packages)
    }

module.exports = {
    create       : create
}