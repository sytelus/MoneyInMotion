define("repository", ["jquery", "common/utils", "Transactions"], function ($, utils, Transactions) {
    "use strict";

    //privates
    var currentRequest, transactionsGetPromise, cachedTransactionsGetPromise;

    var getTransactions = function (forceRefresh) {
        if (forceRefresh || !cachedTransactionsGetPromise) {
            //If there is a pending request, don't start new one
            if (!currentRequest || currentRequest.state() !== "pending") {
                currentRequest = $.getJSON("api/transactions");
                transactionsGetPromise = utils.createDeferred();
                utils.log("Started Ajax request", 100);

                currentRequest.done(function (data, textStatus) {
                    utils.log(["getJSON success: ", textStatus], 10, "success");

                    var txs = new Transactions(data);

                    utils.subscribe(txs, "editsApplied", editAppliedHandler);

                    cachedTransactionsGetPromise = transactionsGetPromise;

                    transactionsGetPromise.resolve(txs);
                });

                currentRequest.fail(function (xhr, textStatus, error) {
                    utils.log(["getJSON failed: ", textStatus, error, xhr.responseText], 0, "error");

                    transactionsGetPromise.reject(error, textStatus, xhr.responseText);
                });

                return transactionsGetPromise;
            }
            else {
                return transactionsGetPromise;
            }
        }
        else {
            return cachedTransactionsGetPromise;
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
            cachedTransactionsGetPromise = undefined;
        }
    };
});
