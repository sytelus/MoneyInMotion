define("app", ["domReady", "bootstrap", "txExplorerView", "jquery.ba-bbq", "common/utils", "templateHelpers"],
    function (domReady, $, txExplorerView, jQueryBbq, utils, templateHelpers) {
    "use strict";
    domReady(function () {
        utils.logger.log("Loaded on: ", new Date());

        //Setup app specific template helpers
        templateHelpers.registerAll(utils);

        txExplorerView.initialize();

        //Enable hashchange event for jslink anchors using delegated events
        $(document).on("click", ".jslink  a[href^=#]", function (event) {   //NOTE: jquery live events don"t bubble up in iOS except for a and button elements
            var url = $(this).attr("href");
            $.bbq.pushState(url);
            event.preventDefault();
        });

        //Global event handler for hash change for jslink anchors
        $(window).bind("hashchange", function (e) {
            var action = e.getState("action");
            var target = e.getState("target") || "main";

            utils.logger.log("hashchange occured with action: ", action, " target: ", target);
            
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
