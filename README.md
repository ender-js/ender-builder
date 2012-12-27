# Ender Builder [![Build Status](https://secure.travis-ci.org/ender-js/ender-builder.png)](http://travis-ci.org/ender-js/ender-builder)

A component of the [Ender CLI](https://github.com/ender-js/Ender/) but can also be used as a stand-alone tool to assemble Ender builds.

Ender Builder is responsible for bundling up all required packages and their dependencies into a single *ender.js* file (and its associated *ender.min.js* file). It does not install packages, that is left up to the main Ender CLI. It expects to find the packages it needs in the *node_modules* directory.

Ender Builder isn't responsible for including the "client lib" (*ender-js*) in the list of packages to be bundled, that is left up to the main Ender CLI before deferring the build to Ender Builder.

Ender Builder uses [ender-minify](https://github.com/ender-js/ender-minify) for build minification so it understands `--minifier` / `options.minifier`.

## Executable

If you install with `npm install ender-builder -g` then you'll get an `ender-builder` executable that you can use to build *ender.js* files given a list of packages that already exist in the *node_modules* directory (remember to include *ender-js* if you need it).

```sh
$ ender-builder ender-js bonzo bean traversty --output winning.js
```

## About Ender

For more information check out [http://ender.jit.su](http://ender.jit.su)

## API

### enderBuilder(options, packages, dependencyGraph, callback)
Ender Builder exports a single main function. You must provide it with a standarrd Ender `options` object (which can be obtained from [ender-args-parser](https://github.com/ender-js/ender-args-parser)), an array of `packages` (which is available on `options.packages` if you are parsing the command line), a `DependencyGraph` object (obtained from [ender-dependency-graph](https://github.com/ender-js/ender-dependency-graph)) and a `callback` function to be notified when building is finished.

The callback signature is: `function (err, filename)` where `filename` is the name of the unminified file, usually *ender.js*.

-------------------------

### enderBuilder.minify(options, source, callback)
`minify()` is a wrapper around [ender-minify](https://github.com/ender-js/ender-minify) that basically takes an `options` object and turns it into a form that *ender-minify* can understand.

-------------------------

## Contributing

Contributions are more than welcome! Just fork and submit a GitHub pull request! If you have changes that need to be synchronized across the various Ender CLI repositories then please make that clear in your pull requests.

### Tests

Ender Builder uses [Buster](http://busterjs.org) for unit testing. You'll get it (and a bazillion unnecessary dependencies) when you `npm install` in your cloned local repository. Simply run `npm test` to run the test suite.

## Licence

*Ender Builder* is Copyright (c) 2012 [@rvagg](https://github.com/rvagg), [@ded](https://github.com/ded), [@fat](https://github.com/fat) and other contributors. It is licenced under the MIT licence. All rights not explicitly granted in the MIT license are reserved. See the included LICENSE file for more details.