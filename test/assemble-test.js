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

var async         = require('async')
  , buster        = require('bustermove')
  , assert        = require('referee').assert
  , refute        = require('referee').refute

  , argsParser    = require('ender-args-parser')

  , assemble      = require('../lib/assemble')
  , SourceBuild   = require('../lib/source-build')
  , minify        = require('../lib/minify')


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
      
      result += Object.keys(pkg.sources).sort().map(function (name, i) {
        return (
            "    " + JSON.stringify(name)
          + ": function (module, exports, require) {\n\n"
          + indent(pkg.sources[name], 6)
          + "\n    }"
        )
      }).join(",\n")
      
      result += "\n  }, " + pkg._exposed
      result += ", " + JSON.stringify(pkg.main)
      
      if (pkg.bridge) result += ", " + JSON.stringify(pkg.bridge)
      
      result += ");\n"
      
      return result
    }
    
  , createExpectedBareMain = function (pkg) {
      var result = '' 
      Object.keys(pkg.sources).sort().forEach(function (name, i) {
        if (name == pkg.main) result = indent(pkg.sources[name], 2)
      })
      return result
    }
  
  , createExpectedBareBridge = function (pkg) {
      var result = '' 
      Object.keys(pkg.sources).sort().forEach(function (name, i) {
        if (name == pkg.bridge) result = indent(pkg.sources[name], 2)
      })
      return result
    }

buster.testCase('Source build', {
    'setUp': function () {
      
      this.createPackageMock = function (descriptor) {
        var pkg = Object.create(descriptor)
        
        pkg.loaders = {}

        // Normally this is an async method, but not here
        pkg.loadSources = function (callback) {
          var files = pkg.files || []
          if (pkg.main) files.push(pkg.main)
          if (pkg.bridge) files.push(pkg.bridge)

          pkg.sources = {}
          files.forEach(function (file) {
            pkg.sources[file.replace(/\.js?$/, '')] = "// " + pkg.name + "/" + file + " contents\n"
          })
          
          if (callback) callback()
        }
        
        pkg.__defineGetter__('root', function () {
          return path.resolve(path.join('.', 'node_modules', name))
        })
        
        pkg.__defineGetter__('id', function () {
          return pkg.name + '@' + pkg.version
        })
        
        return pkg
      }

      this.runAssembleTest = function (options, done) {
      
        this.mock(argsParser)
            .expects('toContextString').withExactArgs(options.options).once()
            .returns(options.contextString)

        // This is so we can simplify the createExpectedPackage function
        options.packages.forEach(function (pkg) {
          pkg._exposed = (!options.options ||
                          !options.options.sandbox ||
                          (Array.isArray(options.options.sandbox) &&
                           options.options.sandbox.indexOf(pkg.name) == -1))
        })

        async.map(
            options.packages
          , function (pkg, cb) { pkg.loadSources(cb) }
          , function (err) {
              var barePackages = options.packages.filter(function (pkg) { return pkg.bare })
                , regularPackages = options.packages.filter(function (pkg) { return !pkg.bare })
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
                    { name: 'pkg1', version: '0.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                  )
                , this.createPackageMock(
                    { name: 'pkg2', version: '1.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                  )
                , this.createPackageMock(
                    { name: 'pkg3', version: '1.2.3', main: 'lib/main', bridge: 'lib/bridge' }
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
                    { name: 'pkg1', version: '0.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                  )
                , this.createPackageMock(
                    { name: 'pkg2', version: '1.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                  )
                , this.createPackageMock(
                    { name: 'pkg3', version: '1.2.3', main: 'lib/main', bridge: 'lib/bridge' }
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
                    { name: 'pkg1', version: '0.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                  )
                , this.createPackageMock(
                    { name: 'pkg2', version: '1.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                  )
                , this.createPackageMock(
                    { name: 'pkg3', version: '1.2.3', main: 'lib/main', bridge: 'lib/bridge' }
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
                  { bare: true, name: 'pkg1', version: '0.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                )
              , this.createPackageMock(
                  { bare: true, name: 'pkg2', version: '1.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                )
              , this.createPackageMock(
                  { name: 'pkg3', version: '1.2.3', main: 'lib/main', bridge: 'lib/bridge' }
                )
              , this.createPackageMock(
                  { name: 'pkg4', version: '2.3.1', main: 'lib/main', bridge: 'lib/bridge' }
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
                  { bare: true, name: 'pkg1', version: '0.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                )
              , this.createPackageMock(
                  { name: 'pkg2', version: '1.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                )
              , this.createPackageMock(
                  { name: 'pkg3', version: '1.2.3', main: 'lib/main', bridge: 'lib/bridge' }
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
                  { bare: true, name: 'pkg1', version: '0.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                )
              , this.createPackageMock(
                  { name: 'pkg2', version: '1.1.1', main: 'lib/main', bridge: 'lib/bridge' }
                )
              , this.createPackageMock(
                  { name: 'pkg3', version: '1.2.3', main: 'lib/main', bridge: 'lib/bridge' }
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