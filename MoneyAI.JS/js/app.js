define("app", ["domReady", "bootstrap", "txExplorerView", "common/utils", "templateHelpers", "common/statusBox", "common/globalEvents"],
    function (domReady, $, txExplorerView, utils, templateHelpers, statusBox, globalEvents) {
    "use strict";
    domReady(function () {
        utils.log(["Loaded on: ", new Date()]);

        globalEvents(utils);

        //Setup app specific template helpers
        templateHelpers.registerAll(utils);

        $("#statusBox").statusBox();

        //App specific initializations
        txExplorerView.initialize();

        //Global event handler for hash change for jslink anchors
        $(window).bind("hashchange", function (e) {
            var action = e.getState("action");
            var target = e.getState("target") || "main";

            utils.log(["hashchange occured with action: ", action, " target: ", target]);
            
            if ((target === "txx" || target === "main") && $("#txExplorer").length) {
                var params = $.deparam(e.fragment);
                txExplorerView.onHashChange(params);
            }
            //else ignore unknown state
        });

        //Force hashchange for the first page load
        $(window).trigger("hashchange");
    });
});
