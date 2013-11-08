define("txListView", ["lodash", "Transaction", "common/utils", "text!templates/txList.txt", "TransactionAggregator"],
    function (_, Transaction, utils, templateText, TransactionAggregator) {

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
        refresh: function (txs, selectedYear, selectedMonth) {
            //first filter out the transactions
            var selectedTxs = _.filter(txs.items, function (tx) {
                return tx.correctedValues.transactionYearString === selectedYear && tx.correctedValues.transactionMonthString === selectedMonth;
            });

            var netAggregator = new TransactionAggregator(undefined, "Net", "Net/Net", false, incomeExpenseChildAggregator);

            utils.forEach(selectedTxs, function (tx) {
                Transaction.prototype.ensureAllCorrectedValues.call(tx);
                netAggregator.add(tx);
            });
            

            var templateData = netAggregator;

            compiledTemplate = compiledTemplate || utils.compileTemplate(templateText);
            var templateHtml = utils.runTemplate(compiledTemplate, templateData);

            $("#txList").html(templateHtml);
        }
    };
});