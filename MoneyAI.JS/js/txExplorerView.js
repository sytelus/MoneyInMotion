define("txExplorerView", ["txListView", "txNavigationView"], function (txListView, txNavigationView) {
    "use strict";
    return {
        initialize: function () {
            txListView.initialize();
            txNavigationView.initialize();
        },
        load: function (txs, txEdits) {
            txNavigationView.load(txs, txEdits);
        }
    };
});