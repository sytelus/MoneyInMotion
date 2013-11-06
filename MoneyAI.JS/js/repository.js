define('repository', ["jquery", "utils"], function ($, utils) {
    "use strict";

    //privates
    var cahedValues = {};
    var currentAjaxRequest;

    //public interface
    return {
        getTransactions: function (onGet, onFail, forceRefresh) {
            if (forceRefresh || !cahedValues.transactions) {
                if (!currentAjaxRequest || currentAjaxRequest.state() != "pending") {
                    currentAjaxRequest = $.getJSON("data/LatestMerged.json");
                    utils.logger.log("Started Ajax request");
                }

                currentAjaxRequest.done(function (data, textStatus) {
                    utils.logger.log("getJSON success: ", textStatus);
                    cahedValues.transactions = data;
                    onGet(data);
                });

                currentAjaxRequest.fail(function (jqxhr, textStatus, error) {
                    utils.logger.log("getJSON failed: ", textStatus, error);
                    if (!!onFail) {
                        onFail(error);
                    }
                    else throw error;
                });

                currentAjaxRequest.always(function () {
                    utils.logger.log("getTransactions complete");
                });
            }
            else {
                onGet(cahedValues.transactions);
            }
        },

        invalidateTransactions: function () {
            delete cahedValues.transactions;
        }
    };
});
