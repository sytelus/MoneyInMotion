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
        "bootstrap": "ext/bootstrap/dist/js/bootstrap",
        //"jqueryui": "ext/jquery-ui/ui/jquery-ui",
        //"jstree": "ext/jstree/dist/jstree",
        "jquery.hotkeys": "ext/jquery.hotkeys/jquery.hotkeys",
        "jquery.cookie": "ext/jquery.cookie/jquery.cookie",
        "moment": "ext/momentjs/moment",
        "buckets": "ext/buckets/buckets",
        "text": "ext/requirejs-text/text",
        "handlebars": "ext/handlebars/handlebars",
        "jquery.ba-bbq": "ext/jquery.ba-bbq/jquery.ba-bbq",
        "debug": "ext/javascript-debug/ba-debug",
        "accounting": "ext/accounting/accounting",
        "jquery.layout": "ext/jquery.layout/dist/jquery.layout-latest"
    },
    shim: {
        "debug": {
            exports: "debug"
        },
        //"jqueryui": {
        //    deps: ["jquery"],
        //    exports: "jQuery"
        //},
        "bootstrap": {
            deps: ["jquery"],
            exports: "jQuery"
        },
        "jquery.layout": {
            deps: ["jqueryui"],
            exports: "jQuery"
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
        "jquery.ba-bbq": {
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