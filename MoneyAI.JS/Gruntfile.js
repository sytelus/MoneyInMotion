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
            bowerUpdate: ['<%= paths.src %>/fonts/**']
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

        less: {
            dist: {
                options: {
                    paths: ['<%= paths.src %>/css'],
                    cleancss: false,
                    compress: false,
                    strictUnits: true
                },
                files: {
                    '<%= paths.dist %>/css/app.css': '<%= paths.src %>/css/app.less'
                }
            }
        },
        csslint: {
            options: {
                csslintrc: '.csslintrc'
            },
            src: ['<%= paths.dist %>/css/**/*.css']
        },


        //imagemin: {
        //    dist: {
        //        files: [{
        //            expand: true,
        //            cwd: '<%= paths.src %>/images',
        //            src: '**/*.{png,jpg,jpeg,gif}',
        //            dest: '<%= paths.dist %>/images'
        //        }]
        //    }
        //},
        cssmin: {
            dist: {
                files: {
                    '<%= paths.dist %>/css/app.min.css': ['<%= paths.dist %>/css/**/*.css']
                }
            }
        },
        copy: {
            dist: {
                files: [
                    //html file will be modified by requirejs next
                    {cwd: '<%= paths.src %>', src: ['*.{ico,txt}', '.htaccess', '*.htm*'],
                        dest: '<%= paths.dist %>', dot: true, expand: true},
                    //Get fonts in one place
                    {cwd: '<%= paths.src %>/js/ext/font-awesome', src: ['fonts/*'],
                        dest: '<%= paths.dist %>', dot: true, expand: true},
                    {cwd: '<%= paths.src %>/js/ext/bootstrap/dist', src: ['fonts/*'],
                        dest: '<%= paths.dist %>', dot: true, expand: true},
                    {cwd: '<%= paths.src %>', src: ['images/**/*'],
                    dest: '<%= paths.dist %>', dot: true, expand: true
                    }
                ]
            },
            bowerUpdate: {
                files: [
                    //Get fonts in one place after bower update
                    {cwd: '<%= paths.src %>/js/ext/font-awesome', src: ['fonts/*'],
                        dest: '<%= paths.src %>', dot: true, expand: true},
                    {cwd: '<%= paths.src %>/js/ext/bootstrap/dist', src: ['fonts/*'],
                        dest: '<%= paths.src %>', dot: true, expand: true}
                ]
            }
        },
        requirejs: {
            dist: {
                options: {
                    almond: true,
                    //wrap: true,  //https://github.com/asciidisco/grunt-requirejs/blob/master/docs/almondIntegration.md#require-function-not-found-after-almond-integration

                    name: 'main',
                    baseUrl: 'js',
                    mainConfigFile: '<%= paths.src %>/js/main.js',
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

                    normalizeDirDefines: 'all', //http://requirejs.org/docs/optimization.html#turbo
                    useStrict: true
                }
            }
        },

        htmlrefs: {
            dist: {
                src: '<%= paths.dist %>/*.htm*'
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
        },

        //Bower update tasks
        bower: {
            bowerUpdate: {
                options: {
                    install: true,
                    copy: false,
                    verbose: true,
                    cleanTargetDir: false,
                    cleanBowerDir: false,
                    bowerOptions: {}
                }
            }
        }
        
    });

    grunt.registerTask('bowerUpdate', [
        'clean:bowerUpdate',
        'bower',
        'copy:bowerUpdate'
    ]);

    grunt.registerTask('build', [
        'clean:dist',
        'less',
        //'csslint', //bootstrap has too many violations
        //'imagemin',   //currently broken
        'cssmin',
        'copy:dist',
        'requirejs',
        'htmlrefs',
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
