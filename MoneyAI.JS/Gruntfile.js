'use strict';

// # Globbing
// for performance reasons we're only matching one level down:
// 'test/spec/{,*/}*.js'
// use this if you want to match all subfolders:
// 'test/spec/**/*.js'

module.exports = function (grunt) {
    // load all grunt tasks
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    // configurable paths
    var pathsConfig = {
        app: 'js',
        dist: 'dist'
    };

    grunt.initConfig({
        paths: pathsConfig,
        clean: {
            dist: ['.tmp', '<%= paths.dist %>/*'],
            server: '.tmp'
        },
        jshint: {
            options: {
                jshintrc: '.jshintrc'
            },
            all: [
                'Gruntfile.js',
                '<%= paths.app %>/{,*/}*.js',
                '!<%= paths.app %>/ext/*'
            ]
        },
        // not used since Uglify task does concat,
        // but still available if needed
        /*concat: {
            dist: {}
        },*/
        requirejs: {
            dist: {
                // Options: https://github.com/jrburke/r.js/blob/master/build/example.build.js
                options: {
                    // `name` and `out` is set by grunt-usemin
                    baseUrl: 'js',
                    mainConfigFile: 'js/app.js',
                    modules: [{name: 'app'}],
                    optimize: 'none',
                    dir: "js",
                    // TODO: Figure out how to make sourcemaps work with grunt-usemin
                    // https://github.com/paths/grunt-usemin/issues/30
                    //generateSourceMaps: true,
                    // required to support SourceMaps
                    // http://requirejs.org/docs/errors.html#sourcemapcomments
                    preserveLicenseComments: false,
                    useStrict: true,
                    wrap: true
                    //uglify2: {} // https://github.com/mishoo/UglifyJS2
                }
            }
        },
        useminPrepare: {
            html: '<%= paths.app %>/index.html',
            options: {
                dest: '<%= paths.dist %>'
            }
        },
        usemin: {
            html: ['<%= paths.dist %>/{,*/}*.html'],
            css: ['<%= paths.dist %>/css/{,*/}*.css'],
            options: {
                dirs: ['<%= paths.dist %>']
            }
        },
        imagemin: {
            dist: {
                files: [{
                    expand: true,
                    cwd: '<%= paths.app %>/images',
                    src: '{,*/}*.{png,jpg,jpeg}',
                    dest: '<%= paths.dist %>/images'
                }]
            }
        },
        cssmin: {
            dist: {
                files: {
                    '<%= paths.dist %>/css/main.css': [
                        '.tmp/css/{,*/}*.css',
                        '<%= paths.app %>/css/{,*/}*.css'
                    ]
                }
            }
        },
        htmlmin: {
            dist: {
                options: {
                    /*removeCommentsFromCDATA: true,
                    // https://github.com/paths/grunt-usemin/issues/44
                    //collapseWhitespace: true,
                    collapseBooleanAttributes: true,
                    removeAttributeQuotes: true,
                    removeRedundantAttributes: true,
                    useShortDoctype: true,
                    removeEmptyAttributes: true,
                    removeOptionalTags: true*/
                },
                files: [{
                    expand: true,
                    cwd: '<%= paths.app %>',
                    src: '*.html',
                    dest: '<%= paths.dist %>'
                }]
            }
        },
        copy: {
            dist: {
                files: [{
                    expand: true,
                    dot: true,
                    cwd: '<%= paths.app %>',
                    dest: '<%= paths.dist %>',
                    src: [
                        '*.{ico,txt}',
                        '.htaccess'
                    ]
                }]
            }
        },
    });

    grunt.registerTask('build', [
        'clean:dist',
        'useminPrepare',
        'requirejs',
        'imagemin',
        'htmlmin',
        'concat',
        'cssmin',
        'uglify',
        'copy',
        'usemin'
    ]);

    grunt.registerTask('default', [
        'jshint',
        'build'
    ]);
};
