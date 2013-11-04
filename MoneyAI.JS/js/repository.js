define('repository', ["jquery"], function ($) {
    "use strict";
    return {
        getTransactions: function (onGet, onFail, forceRefresh) {
            var that = this;
            if (forceRefresh || !this.transactions) {
                $.getJSON("data/LatestMerged.json", function (data, textStatus) {
                    console.log(textStatus);
                    that.transactions = data;
                    onGet(data);
                })
                .fail(function (jqxhr, textStatus, error) {
                    console.log(textStatus);
                    if (!!onFail) {
                        onFail(error);
                    }
                    else throw error;
                })
                .always(function () {
                    console.log("getTransactions complete");
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
