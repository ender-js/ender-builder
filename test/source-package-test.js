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


var buster          = require('bustermove')
  , assert          = require('referee').assert
  , refute          = require('referee').refute
  , fs              = require('fs')
  , path            = require('path')
  , async           = require('async')
  , SourcePackage   = require('../lib/source-package')
  , FilesystemError = require('errno').custom.FilesystemError

require('./common')
require('glob')

buster.testCase('Source package', {
    'setUp': function () {

      var globExports = require.cache[require.resolve('glob')].exports
      this._oldGlob = globExports.Glob

      // TODO: demystify and clean this mess up
      this.runLoadTest = function (options, done) {
        // options: expectedFileReads, fileContents, readDelays, parents, pkg, json, expectedResult

        var fsMock   = this.mock(fs)
          , srcPkg

        // replace glob.Glob with a simple func that returns the first arg, if it isn't supressed
        // restore it in tearDown
        globExports.Glob = function (f, opt, cb) {
          if (options.filesMissing && options.filesMissing.indexOf(f) != -1)
            cb(null, [])
          else
            cb(null, [ f ])
        }

        options.expectedFileReads.forEach(function (file, index) {
          var exp = fsMock.expects('readFile').withArgs(path.resolve(file), 'utf-8')

          if (!options.readDelays)
            exp.callsArgWith(2, null, options.fileContents[index])
          else {
            setTimeout(function () {
              exp.args[0][2].call(null, null, options.fileContents[index])
            }, options.readDelays[index])
          }
        })

        srcPkg = SourcePackage.create(
            options.pkg
          , options.parents || []
          , options.descriptor
          , options.options || {}
        )

        srcPkg.loadSources(function (err) {
          refute(err)

          for (var key in options.expectedResult)
            assert.equals(srcPkg[key], options.expectedResult[key])
            
          done && done()
        })

        return srcPkg
      }
    }

  , 'tearDown': function () {
      require.cache[require.resolve('glob')].exports.Glob = this._oldGlob
    }

  , 'main-only': {
        'test (single) main-only package without .js extension': function (done) {
          this.runLoadTest({
                expectedFileReads: [ 'node_modules/parent1/node_modules/parent2/node_modules/apkg/lib/mainsrc.js' ]
              , fileContents: [ '// mainsrc.js contents' ]
              , parents: [ 'parent1', 'parent2' ]
              , pkg: 'apkg'
              , descriptor: { name: 'apkg-name', main: 'lib/mainsrc' }
              , expectedResult: {
                  sources: [
                      { file: 'lib/mainsrc.js', name: 'lib/mainsrc', contents: '// mainsrc.js contents' }
                  ]
                }
            },  done)
        }

      , 'test (single) main-only package with .js extension': function (done) {
          this.runLoadTest({
                expectedFileReads: [ 'node_modules/parent1/node_modules/parent2/node_modules/apkg/lib/mainsrc.js' ]
              , fileContents: [ '// mainsrc.js contents' ]
              , parents: [ 'parent1', 'parent2' ]
              , pkg: 'apkg'
              , descriptor: { name: 'apkg-name', main: 'lib/mainsrc.js' }
              , expectedResult: {
                  sources: [
                      { file: 'lib/mainsrc.js', name: 'lib/mainsrc', contents: '// mainsrc.js contents' }
                  ]
                }
            },  done)
        }

      , 'test main-only package with additional files (mixed extensions)': function (done) {
          this.runLoadTest({
                expectedFileReads: [
                    'node_modules/mypkg/lib/foo/bar.js'
                  , 'node_modules/mypkg/lib/foo/bar/baz.js'
                  , 'node_modules/mypkg/lib/mainsrc.js'
                ]
              , fileContents: [
                    'BAR!'
                  , 'BAZ!'
                  , '// mainsrc.js contents'
                ]
              , pkg: 'mypkg'
              , descriptor: {
                    name: 'mypkg-name'
                  , main: 'lib/mainsrc.js'
                  , files: [
                        'lib/foo/bar'
                      , 'lib/foo/bar/baz'
                    ]
                }
              , expectedResult: {
                  sources: [
                      { file: 'lib/foo/bar.js', name: 'lib/foo/bar', contents: 'BAR!' }
                    , { file: 'lib/foo/bar/baz.js', name: 'lib/foo/bar/baz', contents: 'BAZ!' }
                    , { file: 'lib/mainsrc.js', name: 'lib/mainsrc', contents: '// mainsrc.js contents' }
                  ]
                }
            },  done)
        }

      , 'test main-only package with additional files (mixed extensions) with out-of-order read returns': function (done) {
          // test that even though we read the source files in parallel that they get returned
          // in the right order in the end. Delay the callbacks from the reads to emulate out-of-order
          // filesystem reads
          this.runLoadTest({
                expectedFileReads: [
                    'node_modules/mypkg/lib/foo/bar.js'
                  , 'node_modules/mypkg/lib/foo/bar/baz.js'
                  , 'node_modules/mypkg/lib/mainsrc.js'
                ]
              , fileContents: [
                    'BAR!'
                  , 'BAZ!'
                  , '// mainsrc.js contents'
                ]
              , readDelays: [ 50, 25, 10 ]
              , pkg: 'mypkg'
              , descriptor: {
                    name: 'mypkg-name'
                  , main: 'lib/mainsrc.js'
                  , files: [
                        'lib/foo/bar'
                      , 'lib/foo/bar/baz'
                    ]
                }
              , expectedResult: {
                  sources: [
                      { file: 'lib/foo/bar.js', name: 'lib/foo/bar', contents: 'BAR!' }
                    , { file: 'lib/foo/bar/baz.js', name: 'lib/foo/bar/baz', contents: 'BAZ!' }
                    , { file: 'lib/mainsrc.js', name: 'lib/mainsrc', contents: '// mainsrc.js contents' }
                  ]
                }
            },  done)
        }
    }

  , 'ender-only': {
        'test ender-only package without .js extension': function (done) {
          this.runLoadTest({
                expectedFileReads: [ 'node_modules/parent1/node_modules/parent2/node_modules/apkg/lib/endersrc.js' ]
              , fileContents: [ '// endersrc.js contents' ]
              , filesMissing: [ 'index.js' ]
              , parents: [ 'parent1', 'parent2' ]
              , pkg: 'apkg'
              , descriptor: { name: 'apkg-name', bridge: 'lib/endersrc' }
              , expectedResult: {
                  sources: [
                      { file: 'lib/endersrc.js', name: 'lib/endersrc', contents: '// endersrc.js contents' }
                  ]
                }
            },  done)
        }

      , 'test ender-only package with .js extension': function (done) {
          this.runLoadTest({
                expectedFileReads: [ 'node_modules/parent1/node_modules/parent2/node_modules/apkg/lib/endersrc.js' ]
              , fileContents: [ '// endersrc.js contents' ]
              , filesMissing: [ 'index.js' ]
              , parents: [ 'parent1', 'parent2' ]
              , pkg: 'apkg'
              , descriptor: { name: 'apkg-name', bridge: 'lib/endersrc.js' }
              , expectedResult: {
                  sources: [
                      { file: 'lib/endersrc.js', name: 'lib/endersrc', contents: '// endersrc.js contents' }
                  ]
                }
            },  done)
        }

      , 'test ender-only package with additional files (mixed extensions)': function (done) {
          this.runLoadTest({
                expectedFileReads: [
                    'node_modules/mypkg/lib/foo/bar.js'
                  , 'node_modules/mypkg/lib/foo/bar/baz.js'
                  , 'node_modules/mypkg/lib/endersrc.js'
                ]
              , fileContents: [
                    'BAR!'
                  , 'BAZ!'
                  , '// endersrc.js contents'
                ]
              , filesMissing: [ 'index.js' ]
              , pkg: 'mypkg'
              , descriptor: {
                    name: 'mypkg-name'
                  , bridge: 'lib/endersrc.js'
                  , files: [
                        'lib/foo/bar'
                      , 'lib/foo/bar/baz'
                    ]
                }
              , expectedResult: {
                  sources: [
                      { file: 'lib/foo/bar.js', name: 'lib/foo/bar', contents: 'BAR!' }
                    , { file: 'lib/foo/bar/baz.js', name: 'lib/foo/bar/baz', contents: 'BAZ!' }
                    , { file: 'lib/endersrc.js', name: 'lib/endersrc', contents: '// endersrc.js contents' }
                  ]
                }
            },  done)
        }

      , 'test ender-only package with additional files (mixed extensions) with out-of-order read returns': function (done) {
          // test that even though we read the source files in parallel that they get returned
          // in the right order in the end. Delay the callbacks from the reads to emulate out-of-order
          // filesystem reads
          this.runLoadTest({
                expectedFileReads: [
                    'node_modules/mypkg/lib/foo/bar.js'
                  , 'node_modules/mypkg/lib/foo/bar/baz.js'
                  , 'node_modules/mypkg/lib/endersrc.js'
                ]
              , fileContents: [
                    'BAR!'
                  , 'BAZ!'
                  , '// endersrc.js contents'
                ]
              , filesMissing: [ 'index.js' ]
              , readDelays: [ 50, 25, 10 ]
              , pkg: 'mypkg'
              , descriptor: {
                    name: 'mypkg-name'
                  , bridge: 'lib/endersrc.js'
                  , files: [
                        'lib/foo/bar'
                      , 'lib/foo/bar/baz'
                    ]
                }
              , expectedResult: {
                  sources: [
                      { file: 'lib/foo/bar.js', name: 'lib/foo/bar', contents: 'BAR!' }
                    , { file: 'lib/foo/bar/baz.js', name: 'lib/foo/bar/baz', contents: 'BAZ!' }
                    , { file: 'lib/endersrc.js', name: 'lib/endersrc', contents: '// endersrc.js contents' }
                  ]
                }
            },  done)
        }
    }

  , 'test main and ender package with addtional files (mixed extensions) and out-of-order read returns': function (done) {
      // crazytown!
      this.runLoadTest({
            expectedFileReads: [
                'node_modules/mypkg/lib/foo/bar.js'
              , 'node_modules/mypkg/lib/foo/bar/baz.js'
              , 'node_modules/mypkg/ender/foo/bar.js'
              , 'node_modules/mypkg/ender/foo/bar/baz.js'
              , 'node_modules/mypkg/mainsrc.js'
              , 'node_modules/mypkg/endersrc.js'
            ]
          , fileContents: [
                'BAR!'
              , 'BAZ!'
              , 'ENDERBAR!'
              , 'ENDERBAZ!'
              , '// mainsrc.js contents'
              , '// endersrc.js contents'
            ]
          , readDelays: [ 50, 10, 25, 40, 10, 20 ]
          , pkg: 'mypkg'
          , descriptor: {
                name: 'mypkg-name'
              , main: './mainsrc.js'
              , bridge: './endersrc'
              , files: [
                    'lib/foo/bar'
                  , 'lib/foo/bar/baz.js'
                  , 'ender/foo/bar.js'
                  , 'ender/foo/bar/baz'
                ]
            }
          , expectedResult: {
              sources: [
                  { file: 'lib/foo/bar.js', name: 'lib/foo/bar', contents: 'BAR!' }
                , { file: 'lib/foo/bar/baz.js', name: 'lib/foo/bar/baz', contents: 'BAZ!' }
                , { file: 'ender/foo/bar.js', name: 'ender/foo/bar', contents: 'ENDERBAR!' }
                , { file: 'ender/foo/bar/baz.js', name: 'ender/foo/bar/baz', contents: 'ENDERBAZ!' }
                , { file: 'mainsrc.js', name: 'mainsrc', contents: '// mainsrc.js contents' }
                , { file: 'endersrc.js', name: 'endersrc', contents: '// endersrc.js contents' }
              ]
            }
        },  done)
    }

  , 'test multiple calls to loadSources on same build before complete': function (done) {
      // test that if we call asString twice prior to it finishing that we'll only
      // process once.
      var expectedResult = {
            sources: [
                { file: 'mainsrc.js', name: 'mainsrc', contents: '// mainsrc.js contents' }
              , { file: 'endersrc.js', name: 'endersrc', contents: '// endersrc.js contents' }
            ]
          }
        , srcPkg = this.runLoadTest({
              expectedFileReads: [
                  'node_modules/mypkg/mainsrc.js'
                , 'node_modules/mypkg/endersrc.js'
              ]
            , fileContents: [
                  '// mainsrc.js contents'
                , '// endersrc.js contents'
              ]
            , readDelays: [ 25, 25 ]
            , pkg: 'mypkg'
            , descriptor: {
                  name: 'mypkg-name'
                , main: './mainsrc.js'
                , bridge: './endersrc.js'
              }
            , expectedResult: expectedResult
          })

        // second call
        srcPkg.loadSources(function (err) {
          refute(err)
          for (var key in expectedResult)
            assert.equals(srcPkg[key], expectedResult[key])
        })

        setTimeout(function () {
          // third call, after 'generated'
          srcPkg.loadSources(function (err) {
            refute(err)
            for (var key in expectedResult)
              assert.equals(srcPkg[key], expectedResult[key])
              
            done()
          })
        }, 50)
    }

  , 'test identifier': function () {
      var json = { name: 'foobar', version: '1.2.3' }
        , srcPackage = SourcePackage.create('foobar', null, json)

      json.__proto__ = { name: 'barfoo' } // original json, see package-descriptor.js
      assert.equals(srcPackage.identifier, 'barfoo@1.2.3')
    }

  , 'test fs error': function (done) {
        var fsMock = this.mock(fs)
          , errArg = new Error('this is an error')

        require.cache[require.resolve('glob')]
          .exports.Glob = function (f, opt, cb) { cb(null, [f]) }
          
        fsMock.expects('readFile').once().callsArgWith(2, errArg)

        SourcePackage
          .create('whatevs', [], { name: 'whatevs', main: './main.js' }, {})
          .loadSources(function (err) {
            assert(err)
            assert(err instanceof FilesystemError)
            assert.same(err.cause, errArg)
            assert.same(err.message, errArg.message)
            done()
          })
    }

  , 'extendOptions': {
        'test nothing to extend': function () {
          var pkg  = SourcePackage.create('whatevs', [], { name: 'whatevs', main: './main.js' }, {})
            , opts = { foo: 'bar' }

          pkg.extendOptions(opts)
          assert.equals(opts, { foo: 'bar' }) // shoudn't be touched
        }

      , 'test externs': function () {
          var pkg  = SourcePackage.create('whatevs', [], { name: 'whatevs', main: './main.js', externs: 'lib/foo.js' }, {})
            , opts = { foo: 'bar' }

          pkg.extendOptions(opts)
          assert.equals(opts, { foo: 'bar', externs: [ path.resolve('node_modules/whatevs/lib/foo.js') ] }) // shoudn't be touched
        }

      , 'test externs with overridden pkg name': function () {
          // just to make sure we're pointing to the right dir, not using the overridden name

          var json = { name: 'whatevs', main: './main.js', externs: 'lib/foo.js' }
            , pkg  = SourcePackage.create('whatevs', [], json, {})
            , opts = { foo: 'bar' }
          json.__proto__ = { name: 'whoa' }

          pkg.extendOptions(opts)
          assert.equals(opts, { foo: 'bar', externs: [ path.resolve('node_modules/whoa/lib/foo.js') ] })
        }

      , 'test externs array and nested pkg': function () {
          var pkg  = SourcePackage.create('whatevs', [ 'boom', 'bang' ], { name: 'whatevs', main: './main.js', externs: [ 'lib/foo.js', 'BOOM.js' ] }, {})
            , opts = { foo: 'bar' }

          pkg.extendOptions(opts)
          assert.equals(opts, { foo: 'bar', externs: [
              path.resolve('node_modules/boom/node_modules/bang/node_modules/whatevs/lib/foo.js')
            , path.resolve('node_modules/boom/node_modules/bang/node_modules/whatevs/BOOM.js')
          ] })
        }

      , 'test externs array over existing externs': function () {
          var pkg  = SourcePackage.create('whatevs', [], { name: 'whatevs', main: './main.js', externs: [ 'lib/foo.js', 'BOOM.js' ] }, {})
            , opts = { foo: 'bar', externs: [ 'existing1.js', 'existing2.js' ] }

          pkg.extendOptions(opts)
          assert.equals(opts, { foo: 'bar', externs: [
              'existing1.js'
            , 'existing2.js'
            , path.resolve('node_modules/whatevs/lib/foo.js')
            , path.resolve('node_modules/whatevs/BOOM.js')
          ] })
        }
    }

  , 'packageRoot': {
        'standard package': function () {
          var pkg  = SourcePackage.create('whatevs', [ 'boom', 'bang' ], Object.create({ name: 'whatevs', main: './main.js', externs: [ 'lib/foo.js', 'BOOM.js' ] }), {})
          assert.equals(pkg.root, path.resolve('node_modules/boom/node_modules/bang/node_modules/whatevs/'))
        }

      , 'package installed from path': function () {
          var pkg  = SourcePackage.create('/foo/bar/whatevs', [], Object.create({ name: 'whatevs', main: './main.js', externs: [ 'lib/foo.js', 'BOOM.js' ] }), {})
          assert.equals(pkg.root, path.resolve('node_modules/whatevs/'))
        }

      , 'cwd package': function () {
          var pkg  = SourcePackage.create('./', [], Object.create({ name: 'whatevs', main: './main.js', externs: [ 'lib/foo.js', 'BOOM.js' ] }), {})
          assert.equals(pkg.root, path.resolve('.'))

          var pkg  = SourcePackage.create('.', [], Object.create({ name: 'whatevs', main: './main.js', externs: [ 'lib/foo.js', 'BOOM.js' ] }), {})
          assert.equals(pkg.root, path.resolve('.'))

          var pkg  = SourcePackage.create('foo/..', [], Object.create({ name: 'whatevs', main: './main.js', externs: [ 'lib/foo.js', 'BOOM.js' ] }), {})
          assert.equals(pkg.root, path.resolve('.'))
        }
    }
})