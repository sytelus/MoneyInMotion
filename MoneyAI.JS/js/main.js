require.config({
    //enforceDefine: true,  //To get timely, correct error triggers in IE, force a define/shim exports check.
    baseUrl: ".",
    paths: {
        /*
        jquery: ["//ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js", "ext/jquery/jquery"],  
        jqueryui: ["//ajax.googleapis.com/ajax/libs/jqueryui/1.10.3/jquery-ui.min.js", "ext/jquery-ui/ui/jquery-ui"] ,
        */
        "lodash": "js/ext/lodash/dist/lodash",
        "jquery": "js/ext/jquery/jquery",
        "domReady": "js/ext/requirejs-domready/domReady",
        "jqueryui": "js/ext/jquery-ui/ui/jquery-ui",
        //"jstree": "js/ext/jstree/dist/jstree",
        "jquery.hotkeys": "js/ext/jquery.hotkeys/jquery.hotkeys",
        "jquery.cookie": "js/ext/jquery.cookie/jquery.cookie",
        "moment": "js/ext/momentjs/moment",
        "buckets": "js/ext/buckets/buckets",
        "text": "js/ext/requirejs-text/text",
        "handlebars": "js/ext/handlebars/handlebars"
    },
    shim: {
        "jqueryui": {
            deps: ["jquery"],
            export: "jQuery"
        },
        /*
        "jstree": {
            deps: ["jquery", "jqueryui", "jquery.hotkeys", "jquery.cookie"],
            exports: "jQuery.fn.jstree"
        },
        */
        "jquery.hotkeys": {
            deps: ["jquery"],
            exports: "jQuery"
        },
        "jquery.cookie": {
            deps: ["jquery"],
            exports: "jQuery"
        },
        "buckets": {
            exports: "buckets"
        },
        "handlebars": {
            exports: "Handlebars"
        }
    }
});

require(["app"]);   //Allows triggering when using almond