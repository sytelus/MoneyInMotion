define('app', ["domReady", "repository", "jquery", "txExplorerView", "jquery.ba-bbq", "utils"], function (domReady, repository, $, txExplorerView, bbq, utils) {
    "use strict";
    domReady(function () {
        txExplorerView.initialize();

        utils.logger.log("Loaded on: " + new Date());
        repository.getTransactions(function (data) {
            utils.logger.log("Recieved: ", data.Name, "Items", data.items.length, "First createdate", data.items[0].auditInfo.createDate);
            txExplorerView.load(data);
        });


        //Enable hashchange event for jslink anchors using delegated events
        $(document).on("click", ".jslink  a[href^=#]", function () {   //NOTE: jquery live events don't bubble up in iOS except for a and button elements
            var url = $(this).attr('href');
            $.bbq.pushState(url);
            return false;   //prevent default click
        });

        //Global event handler for hash change for jslink anchors
        $(window).bind('hashchange', function (e) {
            var action = e.getState("action");
            $("#log").append("<br/>hashchange occured with action " + action);
            if (action == "showmonth") {
                var year = parseInt(e.getState("year"), 10);
                var month = parseInt(e.getState("month"), 10);

                txExplorerView.showMonth(year, month);
            }
            //else ignore unknown state
        });

        //Force hashchange for the first page load
        $(window).trigger('hashchange');
    });
});
