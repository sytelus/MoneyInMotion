require.config({
    //To get timely, correct error triggers in IE, force a define/shim exports check.
    //enforceDefine: true,
    baseUrl: "js",
    paths: {
        jquery: "ext/jquery/jquery",  //fallback  "//ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js"
        jqueryui: "ext/jquery-ui/ui/jquery-ui", //fallback "//ajax.googleapis.com/ajax/libs/jqueryui/1.10.3/jquery-ui.min.js"],
        domReady: "ext/requirejs-domready/domReady"
    },
    shim: {
        jqueryui: ["jquery"]
    }
});

require(["app"]);   //Allows triggering when using almond