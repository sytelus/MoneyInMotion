define("txExplorerView", ["txListView", "txNavigationView"], function (txListView, txNavigationView) {
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
            console.log("year: " + year + " month: " + month);
            if (year && month) {
                //TODO
            }
        }
    };
});