require.config({
    //enforceDefine: true,  //To get timely, correct error triggers in IE, force a define/shim exports check.
    baseUrl: "js",
    paths: {
        /*
        jquery: ["//ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js", "ext/jquery/jquery"],  
        jqueryui: ["//ajax.googleapis.com/ajax/libs/jqueryui/1.10.3/jquery-ui.min.js", "ext/jquery-ui/ui/jquery-ui"] ,
        */
        jquery: "ext/jquery/jquery",
        jqueryui: "ext/jquery-ui/ui/jquery-ui",
        domReady: "ext/requirejs-domready/domReady"
    },
    shim: {
        "jQueryUI": {
            export: "$",
            deps: ['jQuery']
        }
    }
});

require(["app"]);   //Allows triggering when using almond