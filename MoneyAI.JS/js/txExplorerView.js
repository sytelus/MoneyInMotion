define("txExplorerView", ["txListView", "txNavigationView", "utils", "repository"], function (txListView, txNavigationView, utils, repository) {
    "use strict";
      
    //public interface
    return {
        initialize: function () {
            txListView.initialize();
            txNavigationView.initialize();
        },

        refresh: function (year, month) {
            utils.logger.log("Refresh Request for:", "year: ", year, " month: ", month);

            repository.getTransactions(function (txs) {
                utils.logger.log("txs Data: ", "Items: ", txs.items.length, "First createdate: ", txs.items[0].auditInfo.createDate);
                txNavigationView.refresh(txs);
            });
        }
    };
});