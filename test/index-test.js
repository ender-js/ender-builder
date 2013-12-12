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
  , fs            = require('fs')
  , path          = require('path')

  , argsParser    = require('ender-args-parser')
  , LocalPackage  = require('ender-package').LocalPackage

  , builder       = require('../lib/index')
  , assemble      = require('../lib/assemble')
  , minify        = require('../lib/minify')


buster.testCase('Source build', {
    'setUp': function () {
      this.createPackageMock = function (name, expectExtendOptions) {
        var pkg = LocalPackage.create(path.resolve(path.join('node_modules', name)))
          , pkgMock = this.mock(pkg)

        pkgMock.expects('loadSources').once().callsArgWith(0, null)
        if (expectExtendOptions) pkgMock.expects('extendOptions').once().returns({})

        return pkg
      }
    }

  , 'asString': {
        'plain': function (done) {
          var packagesArg = [
                  this.createPackageMock('pkg1', false)
                , this.createPackageMock('pkg2', false)
                , this.createPackageMock('pkg3', false)
              ]
            , buildResults = { build: 'unminified', sourceMap: 'source map' }
            , optionsArg = { options: 1, minifier: 'none' }
            , assembleMock = this.mock(assemble)
            , minifyMock = this.mock(minify)
            , fsMock = this.mock(fs)

          assembleMock
            .expects('assemble')
            .once()
            .withArgs('ender.js', 'ender.js.map', optionsArg, packagesArg)
            .callsArgWith(4, null, buildResults)

          minifyMock.expects('minify').never()
          fsMock.expects('writeFile').twice().callsArg(3)

          builder(optionsArg, packagesArg, function (err) {
            refute(err)
            assert.equals(buildResults.build, 'unminified')
            assert.equals(buildResults.sourceMap, 'source map')
            assert.equals(buildResults.minifiedBuild, undefined)
            done()
          })
        }

      , 'minify': function (done) {
          var packagesArg = [
                  this.createPackageMock('pkg1', true)
                , this.createPackageMock('pkg2', true)
                , this.createPackageMock('pkg3', true)
              ]
            , buildResults = { build: 'unminified', sourceMap: 'source map' }
            , buildResults = { build: 'unminified', sourceMap: 'source map' }
            , optionsArg = { options: 1, minifier: 'uglify' }
            , assembleMock = this.mock(assemble)
            , minifyMock = this.mock(minify)
            , fsMock = this.mock(fs)

            assembleMock
              .expects('assemble')
              .once()
              .withArgs('ender.js', 'ender.js.map', optionsArg, packagesArg)
              .callsArgWith(4, null, buildResults)

          minifyMock.expects('minify').once().withArgs(optionsArg, 'unminified').callsArgWith(2, null, 'minified')
          fsMock.expects('writeFile').thrice().callsArg(3)

          builder(optionsArg, packagesArg, function (err) {
            refute(err)
            assert.equals(buildResults.build, 'unminified')
            assert.equals(buildResults.sourceMap, 'source map')
            assert.equals(buildResults.minifiedBuild, 'minified')
            done()
          })
        }

        // the minifier function should be passed an options object that has been extended by
        // each of the packages, this allows for packages to add on options such as 'externs'
        // which are passed to the minifier
      , 'minify extends options for each package (externs)': function (done) {
          var packagesArg = [
                  this.createPackageMock('pkg1', true)
                , this.createPackageMock('pkg2', true)
                , this.createPackageMock('pkg3', true)
              ]
            , buildResults = { build: 'unminified', sourceMap: 'source map' }
            , optionsArg = { options: 1, minifier: 'closure', externs: [ 'extern0' ] }
            , expectedOptionsArg = { options: 1, minifier: 'closure', externs: [ 'extern0', 'extern1', 'extern2', 'extern3' ] }
            , assembleMock = this.mock(assemble)
            , minifyMock = this.mock(minify)
            , fsMock = this.mock(fs)

          // sort of mock out the extendOptions() function
          packagesArg[1].extendOptions = function (options) {
            options.externs.push('extern1')
            options.externs.push('extern2')
          }
          packagesArg[2].extendOptions = function (options) {
            options.externs.push('extern3')
          }

          assembleMock
            .expects('assemble')
            .once()
            .withArgs('ender.js', 'ender.js.map', optionsArg, packagesArg)
            .callsArgWith(4, null, buildResults)

          minifyMock.expects('minify').once().withArgs(expectedOptionsArg, 'unminified').callsArgWith(2, null, 'minified')
          fsMock.expects('writeFile').thrice().callsArg(3)

          builder(optionsArg, packagesArg, function (err) {
            refute(err)
            assert.equals(buildResults.build, 'unminified')
            assert.equals(buildResults.sourceMap, 'source map')
            assert.equals(buildResults.minifiedBuild, 'minified')
            done()
          })
        }
    }
})