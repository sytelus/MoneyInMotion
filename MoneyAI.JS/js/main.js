require.config({
    //enforceDefine: true,  //To get timely, correct error triggers in IE, force a define/shim exports check.
    baseUrl: "js",
    paths: {
        /*
        jquery: ["//ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js", "ext/jquery/jquery"],  
        jqueryui: ["//ajax.googleapis.com/ajax/libs/jqueryui/1.10.3/jquery-ui.min.js", "ext/jquery-ui/ui/jquery-ui"] ,
        */
        "lodash": "ext/lodash/dist/lodash",
        "jquery": "ext/jquery/jquery",
        "domReady": "ext/requirejs-domready/domReady",
        "jqueryui": "ext/jquery-ui/ui/jquery-ui",
        "jstree": "ext/jstree/dist/jstree",
        "jquery.hotkeys": "ext/jquery.hotkeys/jquery.hotkeys",
        "jquery.cookie": "ext/jquery.cookie/jquery.cookie",
        "moment": "ext/momentjs/moment",
        "buckets": "ext/buckets/buckets"
    },
    shim: {
        "jqueryui": {
            deps: ["jquery"],
            export: "jQuery"
        },
        "jstree": {
            deps: ["jquery", "jqueryui", "jquery.hotkeys", "jquery.cookie"],
            exports: "jQuery.fn.jstree"
        },
        "jquery.hotkeys": {
            deps: ["jquery"],
            exports: "jQuery"
        },
        "jquery.cookie": {
            deps: ["jquery"],
            exports: "jQuery"
        },
        "buckets": {
            deps: [],
            exports: "buckets"
        }
    }
});

require(["app"]);   //Allows triggering when using almond