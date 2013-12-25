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

        //MoreOrLess panel handling
        $(document).on("click", ".moreTrigger, .lessTrigger", function (event) {
            var trigger = $(this),
                moreOrLessPanel = trigger.closest(".moreOrLessPanel"),
                moreTriggerContainer = moreOrLessPanel.children(".moreTriggerContainer"),
                lessTriggerContainer = moreOrLessPanel.children(".lessTriggerContainer"),
                lessContentContainer = moreOrLessPanel.children(".lessContentContainer"),
                moreContentContainer = moreOrLessPanel.children(".moreContentContainer"),
                isMoreTrigger = trigger.hasClass("moreTrigger") && !trigger.hasClass("lessTrigger");

            moreTriggerContainer.toggle(!isMoreTrigger);
            moreContentContainer.toggle(isMoreTrigger);
            lessTriggerContainer.toggle(isMoreTrigger);
            lessContentContainer.toggle(!isMoreTrigger);

        });

        //Force hashchange for the first page load
        $(window).trigger("hashchange");
    });
});
