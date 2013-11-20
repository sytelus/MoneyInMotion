define("app", ["domReady", "jquery", "txExplorerView", "jquery.ba-bbq", "common/utils", "templateHelpers"],
    function (domReady, $, txExplorerView, jQueryBbq, utils, templateHelpers) {
    "use strict";
    domReady(function () {
        utils.logger.log("Loaded on: ", new Date());

        //Setup app specific template helpers
        templateHelpers.registerAll(utils);

        //Enable hashchange event for jslink anchors using delegated events
        $(document).on("click", ".jslink  a[href^=#]", function () {   //NOTE: jquery live events don"t bubble up in iOS except for a and button elements
            var url = $(this).attr("href");
            $.bbq.pushState(url);
            return false;   //prevent default click
        });

        //Global event handler for hash change for jslink anchors
        $(window).bind("hashchange", function (e) {
            var action = e.getState("action");
            utils.logger.log("hashchange occured with action: ", action);
            if ($("#txExplorer").length) {
                var year = e.getState("year");
                var month = e.getState("month");

                txExplorerView.refresh(year, month);
            }
            //else ignore unknown state
        });

        //Force hashchange for the first page load
        $(window).trigger("hashchange");
    });
});
