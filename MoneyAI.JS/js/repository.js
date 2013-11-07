define("repository", ["jquery", "common/utils"], function ($, utils) {
    "use strict";

    //privates
    var cahedValues = {};
    var currentAjaxRequest, callers;

    //public interface
    return {
        getTransactions: function (callerId, onGet, onFail, forceRefresh) {
            if (forceRefresh || !cahedValues.transactions) {

                //If there is a pending request, don"t start new one
                if (!currentAjaxRequest || currentAjaxRequest.state() !== "pending") {
                    currentAjaxRequest = $.getJSON("data/LatestMerged.json");
                    callers = {};   //list of callers waiting for request
                    utils.logger.log("Started Ajax request", "callerId", callerId);
                }

                //if this caller is not in the list, add it and queue up its callbacks to existing request
                if (!callers[callerId]) {
                    callers.callerId = callerId;

                    currentAjaxRequest.done(function (data, textStatus) {
                        utils.logger.log("getJSON success: ", textStatus, "callerId", callerId);
                        cahedValues.transactions = data;
                        onGet(data);
                    });

                    currentAjaxRequest.fail(function (jqxhr, textStatus, error) {
                        utils.logger.log("getJSON failed: ", textStatus, error, "callerId", callerId);
                        if (!!onFail) {
                            onFail(error);
                        }
                        else {
                            throw error;
                        }
                    });

                    currentAjaxRequest.always(function () {
                        utils.logger.log("getTransactions complete", "callerId", callerId);
                    });
                }
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
