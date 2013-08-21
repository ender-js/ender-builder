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

var buster        = require('bustermove')
  , assert        = require('referee').assert
  , refute        = require('referee').refute
  , argsParser    = require('ender-args-parser')
  , async         = require('async')
  , events        = require('events')
  , mu            = require('mu2')
  , assemble      = require('../lib/assemble')
  , SourcePackage = require('../lib/source-package')
  , SourceBuild   = require('../lib/source-build')
  , minify        = require('../lib/minify')

require('./common')

var indent = function (str, spaces) {
      return str && str.replace(/^/mg, Array(spaces+1).join(' '))
    }
    
  , createExpectedHeader = function (context, packageList) {
      return [
          "/*!"
        , "  * ============================================================="
        , "  * Ender: open module JavaScript framework (https://ender.no.de)"
        , "  * Build: ender " + context
        , "  * Packages: " + packageList
        , "  * ============================================================="
        , "  */"
      ].join('\n') + '\n\n'
    }
    
  , createExpectedPackage = function (pkg) {
      var result = "  Module.loadPackage(" + JSON.stringify(pkg.name) + ", {\n"
      
      result += pkg.sources.map(function (source, i) {
        return (
            "    " + JSON.stringify(source.name)
          + ": function (module, exports, require) {\n\n"
          + indent(source.contents, 6)
          + "\n    }"
        )
      }).join(",\n")
      
      result += "\n  }, " + pkg.isExposed
      result += ", " + JSON.stringify(pkg.main)
      
      if (pkg.bridge) result += ", " + JSON.stringify(pkg.bridge)
      
      result += ");\n"
      
      return result
    }
    
  , createExpectedBareMain = function (pkg) {
      var result = '' 
      pkg.sources.forEach(function (source) {
        if (source.name == pkg.main)
          result = indent(source.contents, 2)
      })
      return result
    }
  
  , createExpectedBareBridge = function (pkg) {
      var result = '' 
      pkg.sources.forEach(function (source) {
        if (source.name == pkg.bridge)
          result = indent(source.contents, 2)
      })
      return result
    }

buster.testCase('Source build', {
    'setUp': function () {
      
      this.createPackageMock = function (name, parents, descriptor, options) {
        var pkg = SourcePackage.create(name, parents, descriptor, options)
        
        // Normally this is an async method, but not here
        this.stub(pkg, 'loadSources', function (callback) {
          var files = descriptor.files || []
          if (pkg.main) files.push(pkg.main)
          if (pkg.bridge) files.push(pkg.bridge)

          this.sources = files.map(function (file) {
            return {
              file: file,
              contents: "// " + name + "/" + file + " contents\n",
              name: file.replace(/\.js?$/, '')
            }
          })
          
          if (callback) callback()
        })
        
        // sinon can't mock getters
        pkg.__defineGetter__('root', function () {
          return path.resolve(path.join('.', 'node_modules', name))
        })
        
        return pkg
      }

      this.runAssembleTest = function (options, done) {
      
        this.mock(argsParser)
            .expects('toContextString').withExactArgs(options.options).once()
            .returns(options.contextString)

        async.map(
            options.packages
          , function (p, cb) { p.loadSources(cb) }
          , function (err) {
              var barePackages = options.packages.filter(function (p) { return p.isBare })
                , regularPackages = options.packages.filter(function (p) { return !p.isBare })
                , expectedResult =
                    createExpectedHeader(options.contextString, options.packageList)
                    + "!function () {\n\n"
                    + (barePackages.length == 0 ? '' :
                        (barePackages.map(createExpectedBareMain).join("\n") + "\n"))
                    + regularPackages.map(createExpectedPackage).join("\n") + "\n"
                    + (options.options.sandbox || barePackages.length == 0 ? '' :
                        (barePackages.map(createExpectedBareBridge).join("\n") + "\n"))
                    + "}.call({});\n"

              assemble.assemble(options.options, options.packages, function (err, actual) {
                refute(err)
                assert.equals(actual, expectedResult)
                done()
              })
            }
        )
      }
    }

  , 'assemble': {
        'basic': function (done) {
          var options = { option: 1 }
            , packages = [
                  this.createPackageMock(
                      'pkg1'
                    , []
                    , { name: 'pkg1', version: '0.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                    , options
                  )
                , this.createPackageMock(
                      'pkg2'
                    , []
                    , { name: 'pkg2', version: '1.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                    , options
                  )
                , this.createPackageMock(
                      'pkg3'
                    , []
                    , { name: 'pkg3', version: '1.2.3', main: 'lib/main', bridge: 'lib/bridge' }
                    , options
                  )
              ]
          
          this.runAssembleTest({
              options: options
            , packages: packages
            , contextString: "some context here & don\'t escape <this>"
            , packageList: "pkg1@0.1.1 pkg2@1.1.1 pkg3@1.2.3"
          }, done)
        }

      , 'basic sandbox': function (done) {
          var options = { sandbox: true }
            , packages = [
                  this.createPackageMock(
                      'pkg1'
                    , []
                    , { name: 'pkg1', version: '0.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                    , options
                  )
                , this.createPackageMock(
                      'pkg2'
                    , []
                    , { name: 'pkg2', version: '1.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                    , options
                  )
                , this.createPackageMock(
                      'pkg3'
                    , []
                    , { name: 'pkg3', version: '1.2.3', main: 'lib/main', bridge: 'lib/bridge' }
                    , options
                  )
              ]
            
          this.runAssembleTest({
              options: options
            , packages: packages
            , contextString: "some context here & don\'t escape <this>"
            , packageList: "pkg1@0.1.1 pkg2@1.1.1 pkg3@1.2.3"
          }, done)
        }

      , 'basic sandbox w/ exposed packages': function (done) {
          var options = { sandbox: ['pkg2'] }
            , packages = [
                  this.createPackageMock(
                      'pkg1'
                    , []
                    , { name: 'pkg1', version: '0.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                    , options
                  )
                , this.createPackageMock(
                      'pkg2'
                    , []
                    , { name: 'pkg2', version: '1.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                    , options
                  )
                , this.createPackageMock(
                      'pkg3'
                    , []
                    , { name: 'pkg3', version: '1.2.3', main: 'lib/main', bridge: 'lib/bridge' }
                    , options
                  )
              ]
          
          this.runAssembleTest({
              options: options
            , packages: packages
            , contextString: "some context here & don\'t escape <this>"
            , packageList: "pkg1@0.1.1 pkg2@1.1.1 pkg3@1.2.3"
          }, done)
        }

    , 'bare packages': function (done) {
        var options = { options: 1 }
          , packages = [
                this.createPackageMock(
                    'pkg1'
                  , []
                  , { bare: true, name: 'pkg1', version: '0.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                  , options
                )
              , this.createPackageMock(
                    'pkg2'
                  , []
                  , { bare: true, name: 'pkg2', version: '1.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                  , options
                )
              , this.createPackageMock(
                    'pkg3'
                  , []
                  , { name: 'pkg3', version: '1.2.3', main: 'lib/main', bridge: 'lib/bridge' }
                  , options
                )
              , this.createPackageMock(
                    'pkg4'
                  , []
                  , { name: 'pkg4', version: '2.3.1', main: 'lib/main', bridge: 'lib/bridge' }
                  , options
                )
            ]
          
        this.runAssembleTest({
            options: options
          , packages: packages
          , contextString: "some context here & don\'t escape <this>"
          , packageList: "pkg1@0.1.1 pkg2@1.1.1 pkg3@1.2.3 pkg4@2.3.1"
        }, done)
      }

    , 'bare packages sandbox': function (done) {
        var options = { sandbox: true }
          , packages = [
                this.createPackageMock(
                    'pkg1'
                  , []
                  , { bare: true, name: 'pkg1', version: '0.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                  , options
                )
              , this.createPackageMock(
                    'pkg2'
                  , []
                  , { name: 'pkg2', version: '1.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                  , options
                )
              , this.createPackageMock(
                    'pkg3'
                  , []
                  , { name: 'pkg3', version: '1.2.3', main: 'lib/main', bridge: 'lib/bridge' }
                  , options
                )
            ]
          
        this.runAssembleTest({
            options: options
          , packages: packages
          , contextString: "some context here & don\'t escape <this>"
          , packageList: "pkg1@0.1.1 pkg2@1.1.1 pkg3@1.2.3"
        }, done)
      }

    , 'bare packages sandbox w/ exposed packages': function (done) {
        var options = { sandbox: ['pkg2'] }
          , packages = [
                this.createPackageMock(
                    'pkg1'
                  , []
                  , { bare: true, name: 'pkg1', version: '0.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                  , options
                )
              , this.createPackageMock(
                    'pkg2'
                  , []
                  , { name: 'pkg2', version: '1.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                  , options
                )
              , this.createPackageMock(
                    'pkg3'
                  , []
                  , { name: 'pkg3', version: '1.2.3', main: 'lib/main', bridge: 'lib/bridge' }
                  , options
                )
            ]
        
        this.runAssembleTest({
            options: options
          , packages: packages
          , contextString: "some context here & don\'t escape <this>"
          , packageList: "pkg1@0.1.1 pkg2@1.1.1 pkg3@1.2.3"
        }, done)
      }
    }
})