define("app", ["domReady", "bootstrap", "TxExplorerView", "common/utils", "templateHelpers", "common/statusBox", "common/globalEvents"],
    function (domReady, $, TxExplorerView, utils, templateHelpers, statusBox, globalEvents) {
    "use strict";

    var txExplorerView;

    domReady(function () {
        utils.log(["Loaded on: ", new Date()]);

        globalEvents(utils);

        //Setup app specific template helpers
        templateHelpers.registerAll(utils);

        $("#footer .statusBox").statusBox();

        var explorerElement = $("#main .txExplorer").first();
        txExplorerView = new TxExplorerView(explorerElement);
        txExplorerView.refresh();
    });
});
