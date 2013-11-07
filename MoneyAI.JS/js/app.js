define("app", ["domReady", "jquery", "txExplorerView", "jquery.ba-bbq", "common/utils", "templateHelpers", "jquery.layout"],
    function (domReady, $, txExplorerView, jQueryBbq, utils, templateHelpers, jQueryLayout) {
    "use strict";
    domReady(function () {
        utils.logger.log("Loaded on: ", new Date());

        //Setup app specific template helpers
        templateHelpers.registerAll(utils);

        //jquery.layout plugin
        $("body").layout({
            //applyDefaultStyles: true,
            north__paneSelector: "#ui-layout-north",
            west__paneSelector: "#ui-layout-west",
            east__paneSelector: "#ui-layout-east",
            south__paneSelector: "#ui-layout-south",
            center__paneSelector: "#ui-layout-center",
            
            north__spacing_open: 1,			// cosmetic spacing
            north__togglerLength_open: 0,			// HIDE the toggler button
            north__togglerLength_closed: -1,			// "100%" OR -1 = full width of pane
            north__resizable: false,
            north__slidable: false,
            north__fxName: "none" ,     //	override default effect

            west__onresize:		$.layout.callbacks.resizePaneAccordions

        });
        /**
         *	UI Layout Callback: resizePaneAccordions
         *
         *	This callback is used when a layout-pane contains 1 or more accordions
         *	- whether the accordion a child of the pane or is nested within other elements
         *	Assign this callback to the pane.onresize event:
         *
         *	SAMPLE:
         *	< jQuery UI 1.9: $("#elem").tabs({ show: $.layout.callbacks.resizePaneAccordions });
         *	> jQuery UI 1.9: $("#elem").tabs({ activate: $.layout.callbacks.resizePaneAccordions });
         *	$("body").layout({ center__onresize: $.layout.callbacks.resizePaneAccordions });
         *
         *	Version:	1.2 - 2013-01-12
         *	Author:		Kevin Dalman (kevin.dalman@gmail.com)
         */
        (function ($) {
            var _ = $.layout;

            // make sure the callbacks branch exists
            if (!_.callbacks) _.callbacks = {};

            _.callbacks.resizePaneAccordions = function (x, ui) {
                // may be called EITHER from layout-pane.onresize OR tabs.show
                var $P = ui.jquery ? ui : $(ui.newPanel || ui.panel);
                // find all VISIBLE accordions inside this pane and resize them
                $P.find(".ui-accordion:visible").each(function () {
                    var $E = $(this);
                    if ($E.data("accordion"))		// jQuery < 1.9
                        $E.accordion("resize");
                    if ($E.data("ui-accordion"))	// jQuery >= 1.9
                        $E.accordion("refresh");
                });
            };
        })($);


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
