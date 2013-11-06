define("txExplorerView", ["txListView", "txNavigationView", "utils", "repository"], function (txListView, txNavigationView, utils, repository) {
    "use strict";
      
    //public interface
    return {
        refresh: function (year, month) {
            utils.logger.log("Refresh Request for:", "year: ", year, " month: ", month);

            repository.getTransactions("txExplorerView.refresh", function (txs) {
                utils.logger.log("txs Data: ", "Items: ", txs.items.length, "First createdate: ", txs.items[0].auditInfo.createDate);
                txNavigationView.refresh(txs, year, month);
            });
        }
    };
});