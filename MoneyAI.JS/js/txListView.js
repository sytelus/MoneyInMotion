define("txListView", ["jquery", "Transaction", "common/utils", "text!templates/txList.txt", "TransactionAggregator"],
    function ($, Transaction, utils, templateText, TransactionAggregator) {

    "use strict";

    //privates
    var compiledTemplate;   //cache compiled template

    var txSortMap = function (tx) {
        return tx.amount;
    };
    var aggregatorSortMap = function (agg) {
        return agg.sum;
    };

    var entityNameChildAggregator = function (parentAggregator, tx) {
        var childAggregators = parentAggregator.childAggregators;
        var entityNameBest = tx.correctedValues.entityNameBest;
        if (!childAggregators[entityNameBest]) {
            childAggregators[entityNameBest] = new TransactionAggregator(parentAggregator, entityNameBest, entityNameBest, true, undefined, txSortMap, false);
        }

        return childAggregators[entityNameBest];
    };

    var getExpenseChildAggregator = function expense(parentAggregator) {
        return new TransactionAggregator(parentAggregator, "Expense", "Expenses", false, entityNameChildAggregator, aggregatorSortMap, false);
    },
    //getIncomeChildAggregator = function income() {
    //    return new TransactionAggregator(parentAggregator, "Income", "Income", false, entityNameChildAggregator, aggregatorSortMap, false);
    //},
    getTransfersChildAggregator = function transfers(parentAggregator) {
        return new TransactionAggregator(parentAggregator, "Transfers", "Transfers", false, entityNameChildAggregator, aggregatorSortMap, false);
    };

    var incomeExpenseChildAggregatorMapping = {
        "0": getExpenseChildAggregator,   //Purchase
        "1": getExpenseChildAggregator, //Adjustment
        "2": getExpenseChildAggregator, //Fee
        "4": getTransfersChildAggregator, //InterAccountPayment
        "8": getExpenseChildAggregator, //Return
        "16": getTransfersChildAggregator //InterAccountTransfer
    };

    var incomeExpenseChildAggregator = function (parentAggregator, tx) {
        var aggregatorFunction = incomeExpenseChildAggregatorMapping[tx.correctedValues.transactionReason.toString()] || getExpenseChildAggregator;
        var childAggregators = parentAggregator.childAggregators;
        if (!childAggregators[aggregatorFunction.name]) {
            childAggregators[aggregatorFunction.name] = aggregatorFunction(parentAggregator);
        }

        return childAggregators[aggregatorFunction.name];
    };



    //publics
    return {
        initialize: function () {
            $("#txListControl").delegate(".txRowExpanderControl", "click", function () {   //NOTE: jquery live events don"t bubble up in iOS except for a and button elements
                var currentState = $(this).prop("checked");
                var expanderId = $(this).attr("id");
                var childRows = $(this).closest("tr").nextAll("tr[data-expanderid=\"" + expanderId + "\"]");
                var expanderIcon = $(this).next("label[for=\"" + expanderId + "\"]").children("i");

                if (currentState) {
                    childRows.attr("class", "txRowCollapsed");
                    expanderIcon.attr("class", "rowsExpandIcon");
                }
                else {
                    childRows.attr("class", "txRowVisible");
                    expanderIcon.attr("class", "rowsCollapseIcon");
                }

                //return false;   //prevent further bubbling
            });
        },

        refresh: function (txs, selectedYear, selectedMonth) {
            //first filter out the transactions
            var selectedTxs = utils.filter(txs.items, function (tx) {
                return tx.correctedValues.transactionYearString === selectedYear && tx.correctedValues.transactionMonthString === selectedMonth;
            });

            var netAggregator = new TransactionAggregator(undefined, "Net", "Net/Net", false, incomeExpenseChildAggregator);

            utils.forEach(selectedTxs, function (tx) {
                Transaction.prototype.ensureAllCorrectedValues.call(tx);
                netAggregator.add(tx);
            });
            
            netAggregator.finalize();

            var templateData = netAggregator;

            compiledTemplate = compiledTemplate || utils.compileTemplate(templateText);
            var templateHtml = utils.runTemplate(compiledTemplate, templateData);

            $("#txListControl").html(templateHtml);
        }
    };
});