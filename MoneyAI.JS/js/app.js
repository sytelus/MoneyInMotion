requirejs.config({
    //To get timely, correct error triggers in IE, force a define/shim exports check.
    //enforceDefine: true,
    baseUrl: "js",
    paths: {
        jquery: ['ext/jquery-1.10.2', '//ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js'],  //fallback 
        jqueryui: ['ext/jquery-ui-1.10.3/ui/jquery-ui', '//ajax.googleapis.com/ajax/libs/jqueryui/1.10.3/jquery-ui.min.js'],
        domReady: 'ext/domReady'
    },
    shim: {
        jqueryui: ['jquery']
    }
});


require(['domReady', 'repository', 'jquery'], function (domReady, repository, $) {
    domReady(function () {
        repository.getTransactions(function (data) {
            $("#log").text(data.Name);
        });
    });
});
