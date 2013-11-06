define("txExplorerView", ["txListView", "txNavigationView", "utils"], function (txListView, txNavigationView, utils) {
    "use strict";
    return {
        initialize: function () {
            txListView.initialize();
            txNavigationView.initialize();
        },
        load: function (txs, txEdits) {
            txNavigationView.load(txs, txEdits);
        },
        showMonth: function (year, month) {
            utils.logger.log("year: ", year, " month: ", month);
            if (year && month) {
                //TODO
            }
        }
    };
});