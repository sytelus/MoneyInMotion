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
                utils.log(["Started Ajax request", "callerId", callerId], 100);
            }

            //if this caller is not in the list, add it and queue up its callbacks to existing request
            if (!callers[callerId]) {
                callers.callerId = callerId;

                currentAjaxRequest.done(function (data, textStatus) {
                    utils.log(["getJSON success: ", textStatus, "callerId", callerId], 10, "success");

                    var txs = new Transactions(data);

                    utils.subscribe(txs, "editsApplied", editAppliedHandler);

                    cachedValues.transactions = txs;
                    var updatedTxs = onGet(txs);
                    if (updatedTxs instanceof Transactions) {
                        cachedValues.transactions = updatedTxs;
                    }
                });

                currentAjaxRequest.fail(function (xhr, textStatus, error) {
                    utils.log(["getJSON failed: ", textStatus, error, "callerId", callerId, xhr.responseText], 0, "error");
                    if (!!onFail) {
                        onFail(error, xhr.responseText);
                    }
                    else {
                        throw new Error(error + " " + xhr.responseText);
                    }
                });

                currentAjaxRequest.always(function () {
                    utils.log(["getTransactions complete", "callerId", callerId]);
                });
            }
        }
        else {
            onGet(cachedValues.transactions);
        }
    },
        
    editAppliedHandler = function (event, edits, affectedTransactionsCount) {
        $.post("api/transactionedits", { "": utils.stringify(edits) }, function (editResult, textStatus) {
            utils.log(["edits", edits.length, "successfully posted", "textStatus", textStatus, "data", editResult, "affectedTransactionsCount", affectedTransactionsCount]);
            if (editResult === undefined || editResult.affectedTransactionsCount !== affectedTransactionsCount) {
                utils.log(["Server AffectedTransactionCount Missmatch!", editResult.affectedTransactionsCount, affectedTransactionsCount], 1, "error");
            }
        })
        .done(function (data, textStatus) {
            utils.log(["edits", edits.length, "successfully applied", "textStatus", textStatus, "data", data, "affectedTransactionsCount", affectedTransactionsCount], 10, "success");
        })
        .fail(function (xhr, textStatus, error) {
            //TODO: handle this!
            utils.log(["edits", edits.length, "failed to posted", "affectedTransactionsCount", affectedTransactionsCount, "textStatus", textStatus, "error", error,
                "responseText", xhr.responseText], 0, "error");
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
