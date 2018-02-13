// # gulpfile.js

/* eslint quotes:["error", "single"], strict:0 */

// ## Usage
// Tasks
// - [`gulp`](#-default-task) - rebuild for development and watch for changes
// - [`gulp clean`](#-clean-task) - clean build directories

// Options
// - `--prod` - build for production instead of development

// Configuration
// See [Configuration](#configuration) section below.

// ## Dependencies

var packageJson = require('./package.json')

// - General dependencies.
var gulp = require('gulp')
// var concat = require('gulp-concat')
var rename = require('gulp-rename')

// - Dependency for `argv` terminal arguments.
// var argv = require('yargs')

// - Dependency for `clean` task.
var clean = require('gulp-clean')

// - Dependency for `lint` task.
var eslint = require('gulp-eslint')

// - Dependency for `test` task.
var mocha = require('gulp-mocha')

// - Dependencies for `scripts` task.
var browserify = require('browserify')
var source = require('vinyl-source-stream')
var buffer = require('vinyl-buffer')
var uglify = require('gulp-uglify')
var sourcemaps = require('gulp-sourcemaps')
// var log = require('gulplog')

// ## Configuration
var config = {}

// File name.
config.name = packageJson.name

// Module name (capitalized first letter).
config.moduleName = packageJson.name.charAt(0).toUpperCase() + packageJson.name.slice(1)

// To build for production, run with `gulp --prod`.
// config.production = argv.prod ? argv.prod : false

// Paths
config.paths = {
  entry: 'src/index.js', // Browserify entry point
  scripts: ['src/index.js', 'src/**/index.js', 'src/**/*.js'],
  tests: ['test/specs/**/*.test.js'],
  dest: 'dist',
}

// ## Tasks

// ### `clean` task
// Clean build directories.
gulp.task('clean', function () {
  return gulp.src(config.paths.dest, {read: false})
    // @TODO: Refactor with `del`.
    .pipe(clean())
})

// ### `scripts` task
// Build js.
gulp.task('scripts', ['lint', 'test'], function () {
  // set up the browserify instance on a task basis
  var b = browserify({
    entries: config.paths.entry,
    debug: true,
    standalone: config.moduleName,
  })

  return b.bundle()
    .pipe(source(config.paths.entry))
    .pipe(buffer())
    .pipe(rename(config.name + '.js'))
    .pipe(gulp.dest(config.paths.dest))
    .pipe(sourcemaps.init({loadMaps: true}))
    // .pipe(concat(config.name + '.js'))
    .pipe(rename(config.name + '.min.js'))
    .pipe(uglify())
    .pipe(sourcemaps.write(''))
    .pipe(gulp.dest(config.paths.dest))
})

// ### `lint` task
// Lint scripts using eslint.
gulp.task('lint', function () {
  return gulp.src(config.paths.scripts)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError())
})

// ### `test` task
// Test scripts using Mocha.
gulp.task('test', function () {
  gulp.src(config.paths.tests, {read: false})
    .pipe(mocha())
})

// ### `watch` task
gulp.task('watch', function () {
  gulp.watch(config.paths.scripts, ['scripts'])
})

// ### `default` task
gulp.task('default', ['clean', 'scripts', 'watch'])
