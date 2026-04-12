require.config({
    //To get timely, correct error triggers in IE, force a define/shim exports check.
    //enforceDefine: true,
    baseUrl: "js",
    paths: {
        jquery: "ext/jquery/jquery-1.10.2",  //fallback  "//ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js"
        jqueryui: "ext/jquery-ui/ui/jquery-ui", //fallback "//ajax.googleapis.com/ajax/libs/jqueryui/1.10.3/jquery-ui.min.js"],
        domReady: "ext/require-plugins/domReady"
    },
    shim: {
        jqueryui: ["jquery"]
    }
});


require(["domReady", "repository", "jquery"], function (domReady, repository, $) {
    "use strict";
    domReady(function () {
        repository.getTransactions(function (data) {
            $("#log").text(data.Name + "<br/>" + data.items.length + "<br/>" + data.items[0].auditInfo.createDate + "<br/>" + new Date(data.items[0].auditInfo.createDate));
        });
    });
});
