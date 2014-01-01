﻿define("txExplorerView", ["txListView", "txNavigationView", "common/utils", "repository"], function (txListView, txNavigationView, utils, repository) {
    "use strict";

    //public interface
    return {
        initialize: function () {
            txNavigationView.initialize();
            txListView.initialize();
        },

        refresh: function (yearString, monthString) {
            utils.log(["Refresh Request for:", "yearString: ", yearString, " monthString: ", monthString]);

            repository.getTransactions("txExplorerView.refresh", function (txs) {
                utils.log(["txs Data: ", "Items: ", txs.items.length, "First createdate: ", txs.items[0].auditInfo.createDate]);
                var lastSelectedYearMonth = txNavigationView.refresh(txs, yearString, monthString);
                txListView.refresh(txs, lastSelectedYearMonth.yearString, lastSelectedYearMonth.monthString);
            });
        },

        onHashChange: function (params) {
            params = utils.isEmpty(params) ? { action: "showmonth" } : params;
            switch (params.action) {
                case "showmonth":
                    this.refresh(params.year, params.month);
                    break;
                default:
                    utils.log(["Unsupported hashchange was routed to txExplorerView", params], 5, "error");
                    this.refresh(params.year, params.month);
                    break;
            }
        }
    };
});