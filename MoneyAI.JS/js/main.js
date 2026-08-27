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
        "cryptojs.core": "ext/cryptojslib/components/core",
        "cryptojs.md5": "ext/cryptojslib/components/md5",
        "cryptojs.base64": "ext/cryptojslib/components/enc-base64",
        "uuidjs": "ext/uuid-js/lib/uuid",
        "json3": "ext/json3/lib/json3",
        "knockout": "ext/knockoutjs/build/output/knockout",
        "mousetrap": "ext/mousetrap/mousetrap",
        "typeahead": "ext/typeahead.js/dist/typeahead"
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
        "typeahead": {
            deps: ["jquery", "knockout"],
            exports: "jQuery"
        },
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
        "handlebars": {
            exports: "Handlebars"
        },
        "cryptojs.core": {
            exports: "CryptoJS"
        },
        "cryptojs.md5": {
            deps: ["cryptojs.core"],
            exports: "CryptoJS" //You can also use "CryptoJS.MD5"
        },
        "cryptojs.base64": {
            deps: ["cryptojs.core"],
            exports: "CryptoJS" //You can also use "CryptoJS.enc.Base64"
        },
        "uuidjs": {
            exports: "UUIDjs"
        }
    }
});

require(["app"]);   //Allows triggering when using almond