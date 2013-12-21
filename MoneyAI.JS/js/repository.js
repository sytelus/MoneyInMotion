define("repository", ["jquery", "common/utils", "Transactions"], function ($, utils, Transactions) {
    "use strict";

    //privates
    var cachedValues = {};
    var currentAjaxRequest, callers;

    var getTransactions = function (callerId, onGet, onFail, forceRefresh) {
        if (forceRefresh || !cachedValues.transactions) {

            //If there is a pending request, don"t start new one
            if (!currentAjaxRequest || currentAjaxRequest.state() !== "pending") {
                currentAjaxRequest = $.getJSON("api/transactions");
                callers = {};   //list of callers waiting for request
                utils.logger.log("Started Ajax request", "callerId", callerId);
            }

            //if this caller is not in the list, add it and queue up its callbacks to existing request
            if (!callers[callerId]) {
                callers.callerId = callerId;

                currentAjaxRequest.done(function (data, textStatus) {
                    utils.logger.log("getJSON success: ", textStatus, "callerId", callerId);

                    var txs = new Transactions(data);

                    utils.addEventHandler(txs, "editsApplied", editAppliedHandler);

                    cachedValues.transactions = txs;
                    var updatedTxs = onGet(txs);
                    if (updatedTxs instanceof Transactions) {
                        cachedValues.transactions = updatedTxs;
                    }
                });

                currentAjaxRequest.fail(function (xhr, textStatus, error) {
                    utils.logger.error("getJSON failed: ", textStatus, error, "callerId", callerId);
                    if (!!onFail) {
                        onFail(error, xhr.responseText);
                    }
                    else {
                        throw new Error(error + " " + xhr.responseText);
                    }
                });

                currentAjaxRequest.always(function () {
                    utils.logger.info("getTransactions complete", "callerId", callerId);
                });
            }
        }
        else {
            onGet(cachedValues.transactions);
        }
    },
        
    editAppliedHandler = function (event, edits) {
        $.post("api/transactionedits", { "": utils.stringify(edits) }, function (data, textStatus) {
            utils.logger.info("edits", edits.length, "successfully posted", "textStatus", textStatus, "data", data);
        })
        .fail(function (xhr, textStatus, error) {
            //TODO: handle this!
            utils.logger.error("edits", edits.length, "failed to posted", "textStatus", textStatus, "error", error, "responseText", xhr.responseText);
        })
        ;
    };

    //public interface
    return {
        getTransactions: getTransactions,

        invalidateCache: function () {
            delete cachedValues.transactions;
        },

        updateCache: function (txs) {
            cachedValues = txs;
        }
    };
});
