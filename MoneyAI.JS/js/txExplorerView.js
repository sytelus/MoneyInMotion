define("txExplorerView", ["txListView", "txNavigationView", "common/utils", "repository"], function (txListView, txNavigationView, utils, repository) {
    "use strict";

    var setTxFlag = function (id, value) {
        repository.getTransactions("txExplorerView.toggleTxFlag", function (txs) {
            txs.setIsUserFlagged(id, value === "true");

            return txs; //Ask repository to update cache
        });

        return true;    //refresh
    },
    setTxGroupFlag = function (id, value) {
        var groupTx = txListView.getTransactionIdsInGroup(id, true);
        repository.getTransactions("txExplorerView.toggleTxFlag", function (txs) {
            utils.forEach(groupTx, function (txId) { txs.setIsUserFlagged(txId, value === "true"); });
            return txs; //Ask repository to update cache
        });

        return true;    //refresh
    },
    executeEdit = function (params) {
        switch (params.name) {
            case "txflag":
                return setTxFlag(params.id, params.value);
            case "txgroupflag":
                return setTxGroupFlag(params.id, params.value);
            default:
                utils.logger.error("Unsupported edit was routed to txExplorerView", params);
                return false;
        }
    };

    var lastSelectedYearMonth;
      
    //public interface
    return {
        initialize: function () {
            txNavigationView.initialize();
            txListView.initialize();
        },

        refresh: function (yearString, monthString) {
            yearString = yearString || (lastSelectedYearMonth ? lastSelectedYearMonth.yearString : undefined);
            monthString = monthString || (lastSelectedYearMonth ? lastSelectedYearMonth.monthString : undefined);

            utils.logger.log("Refresh Request for:", "yearString: ", yearString, " monthString: ", monthString);

            repository.getTransactions("txExplorerView.refresh", function (txs) {
                utils.logger.log("txs Data: ", "Items: ", txs.items.length, "First createdate: ", txs.items[0].auditInfo.createDate);
                lastSelectedYearMonth = txNavigationView.refresh(txs, yearString, monthString);
                txListView.refresh(txs, lastSelectedYearMonth.yearString, lastSelectedYearMonth.monthString);
            });
        },

        onHashChange: function (params) {
            params = utils.isEmpty(params) ? { action: "showmonth" } : params;
            switch (params.action) {
                case "showmonth":
                    this.refresh(params.year, params.month);
                    break;
                case "edit":
                    var refreshRequired = executeEdit(params);
                    if (refreshRequired) {
                        this.refresh();
                    }
                    break;
                default:
                    utils.logger.error("Unsupported hashchange was routed to txExplorerView", params);
                    this.refresh(params.year, params.month);
                    break;
            }
        }
    };
});