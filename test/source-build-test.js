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
  , assemble      = require('../lib/assemble')
  , SourcePackage = require('../lib/source-package')
  , SourceBuild   = require('../lib/source-build')
  , minify        = require('../lib/minify')
  , path          = require('path')

require('./common')

var createExpectedHeader = function (context, packageList) {
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

buster.testCase('Source build', {
    'setUp': function () {
      this.createPackageMock = function (name, parents, descriptor, options) {
        var pkg = SourcePackage.create(name, parents, descriptor, options)
        this.mock(pkg).expects('loadSources').once().callsArgWith(0, null)
        
        // sinon can't mock getters
        pkg.__defineGetter__('root', function () {
          return path.resolve(path.join('.', 'node_modules', name))
        })
        
        return pkg
      }
    }

  , 'asString': {
        'plain': function (done) {
          var pkg1 = this.createPackageMock('pkg1')
            , pkg2 = this.createPackageMock('pkg2')
            , pkg3 = this.createPackageMock('pkg3')
            , optionsArg = { options: 1 }
            , srcBuild = SourceBuild.create(optionsArg)
            , mockMinify = this.mock(minify)
            , mockAssemble = this.mock(assemble)
          
          srcBuild.addPackage(pkg1)
          srcBuild.addPackage(pkg2)
          srcBuild.addPackage(pkg3)
          
          mockAssemble.expects('assemble').once().withArgs(optionsArg, srcBuild.packages).callsArgWith(2, null, 'unminified')
          mockMinify.expects('minify').never()

          srcBuild.asString({ type: 'plain' }, function (err, actual) {
            refute(err)
            assert.equals(actual, 'unminified')
            done()
          })
        }

      , 'minify': function (done) {
          var pkg1 = this.createPackageMock('pkg1')
            , pkg2 = this.createPackageMock('pkg2')
            , pkg3 = this.createPackageMock('pkg3')
            , optionsArg = { options: 1 }
            , srcBuild = SourceBuild.create(optionsArg)
            , mockMinify = this.mock(minify)
            , mockAssemble = this.mock(assemble)

          srcBuild.addPackage(pkg1)
          srcBuild.addPackage(pkg2)
          srcBuild.addPackage(pkg3)

          mockAssemble.expects('assemble').once().withArgs(optionsArg, srcBuild.packages).callsArgWith(2, null, 'unminified')
          mockMinify.expects('minify').once().withArgs(optionsArg, 'unminified').callsArgWith(2, null, 'minified')

          srcBuild.asString({ type: 'minified' }, function (err, actual) {
            refute(err)
            assert.equals(actual, 'minified')
            done()
          })
        }

        // the minifier function should be passed an options object that has been extended by
        // each of the packages, this allows for packages to add on options such as 'externs'
        // which are passed to the minifier
      , 'minify extends options for each package (externs)': function (done) {
          var pkg1 = this.createPackageMock('pkg1')
            , pkg2 = this.createPackageMock('pkg2')
            , pkg3 = this.createPackageMock('pkg3')
            , optionsArg = { options: 1, externs: [ 'extern0' ] }
            , expectedOptionsArg
            , srcBuild = SourceBuild.create(optionsArg)
            , mockMinify = this.mock(minify)
            , mockAssemble = this.mock(assemble)

          srcBuild.addPackage(pkg1)
          srcBuild.addPackage(pkg2)
          srcBuild.addPackage(pkg3)

          // sort of mock out the extendOptions() function
          pkg2.extendOptions = function (options) {
            options.externs.push('extern1')
            options.externs.push('extern2')
          }
          pkg3.extendOptions = function (options) {
            options.externs.push('extern3')
          }
          expectedOptionsArg = { options: 1, externs: [ 'extern0', 'extern1', 'extern2', 'extern3' ] }

          mockAssemble.expects('assemble').once().withArgs(optionsArg, srcBuild.packages).callsArgWith(2, null, 'unminified')
          mockMinify.expects('minify').once().withArgs(expectedOptionsArg, 'unminified').callsArgWith(2, null, 'minified')

          srcBuild.asString({ type: 'minified' }, function (err, actual) {
            refute(err)
            assert.equals(actual, 'minified')
            done()
          })
        }
    }
    
  , 'addPackage': {
        'bare package ordering': function (done) {
          var pkg1 = this.createPackageMock('pkg1')
            , pkg2 = this.createPackageMock('pkg2', null, { bare: true })
            , pkg3 = this.createPackageMock('pkg3', null, { bare: true })
            , optionsArg = { options: 1 }
            , srcBuild = SourceBuild.create(optionsArg)
        
          srcBuild.addPackage(pkg1)
          srcBuild.addPackage(pkg2)
          srcBuild.addPackage(pkg3)
        
          assert.equals(srcBuild.packages, [ pkg2, pkg3, pkg1 ])
          done()
        }
    }
})