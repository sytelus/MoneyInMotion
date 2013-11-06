define('repository', ["jquery", "utils"], function ($, utils) {
    "use strict";
    return {
        getTransactions: function (onGet, onFail, forceRefresh) {
            var that = this;
            if (forceRefresh || !this.transactions) {
                $.getJSON("data/LatestMerged.json", function (data, textStatus) {
                    utils.logger.log("getJSON success: ", textStatus);
                    that.transactions = data;
                    onGet(data);
                })
                .fail(function (jqxhr, textStatus, error) {
                    utils.logger.log("getJSON failed: ", textStatus, error);
                    if (!!onFail) {
                        onFail(error);
                    }
                    else throw error;
                })
                .always(function () {
                    utils.logger.log("getTransactions complete");
                });
            }
            else {
                onGet(this.transactions);
            }
        },
        invalidateTransactions: function () {
            delete this.transactions;
        }
    };
});
