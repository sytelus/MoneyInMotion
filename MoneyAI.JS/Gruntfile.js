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
        src: '.',
        dist: 'dist'  //distribution folder
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
                '<%= paths.src %>/js/**/*.js',
                '!<%= paths.src %>/js/ext/**/*.js'
            ]
        },
        imagemin: {
            dist: {
                files: [{
                    expand: true,
                    cwd: '<%= paths.src %>/images',
                    src: '**/*.{png,jpg,jpeg,gif}',
                    dest: '<%= paths.dist %>/images'
                }]
            }
        },
        cssmin: {
            dist: {
                files: {
                    '<%= paths.dist %>/css/main.css': ['<%= paths.src %>/css/**/*.css']
                }
            }
        },
        copy: {
            dist: {
                files: [{
                    expand: true, dot: true,
                    cwd: '<%= paths.src %>',
                    dest: '<%= paths.dist %>',
                    src: ['*.{ico,txt}', '.htaccess', '*.htm*'] //html file will be modified by requirejs next
                }] 
            }
        },
        requirejs: {
            dist: {
                options: {
                    almond: true,
                    wrap: true,  //https://github.com/asciidisco/grunt-requirejs/blob/master/docs/almondIntegration.md#require-function-not-found-after-almond-integration

                    name: 'main',
                    baseUrl: 'js',
                    mainConfigFile: 'js/main.js',
                    out: '<%= paths.dist %>/js/mainall.js',


                    optimize: 'none',
                    /*
                    optimize: "uglify",
                    uglify: {
                        toplevel: false    //https://github.com/jrburke/requirejs/wiki/Upgrading-to-RequireJS-2.0#wiki-shim
                    },
                    generateSourceMaps: true, // TODO: Figure out how to make sourcemaps work with grunt-usemin https://github.com/paths/grunt-usemin/issues/30
                    preserveLicenseComments: false, // required to support SourceMaps. http://requirejs.org/docs/errors.html#sourcemapcomments
                    */
                    
                    replaceRequireScript: [{
                        files: ['<%= paths.dist %>/index.html'],
                        module: 'main',
                        modulePath: '/' + '<%= paths.dist %>/js/mainall'
                    }],

                    normalizeDirDefines: "all", //http://requirejs.org/docs/optimization.html#turbo
                    useStrict: true
                }
            }
        },
        htmlmin: {
            dist: {
                options: {
                    //removeCommentsFromCDATA: true,
                    // https://github.com/paths/grunt-usemin/issues/44
                    collapseWhitespace: true,
                    collapseBooleanAttributes: true,
                    //removeAttributeQuotes: true,
                    removeRedundantAttributes: true,
                    useShortDoctype: true,
                    //removeEmptyAttributes: true,
                    removeOptionalTags: true
                },
                files: [{
                    expand: true,
                    cwd: '<%= paths.dist %>',
                    src: '*.htm*',
                    dest: '<%= paths.dist %>'   
                }]
            }
        }
    });

    grunt.registerTask('build', [
        'clean:dist',
        'imagemin',
        'cssmin',
        'copy',
        'requirejs',
        'htmlmin'
    ]);

    grunt.registerTask('test', [
        'jshint'
    ]);

    grunt.registerTask('default', [
        'test',
        'build'
    ]);
};
