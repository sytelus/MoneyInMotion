define("NetAggregator", ["common/utils", "TransactionAggregator"], function (utils, TransactionAggregator) {
    "use strict";

    var sortTxRows = function (txRows) {
        txRows.sort(utils.compareFunction(false, function (tx) { return tx.amount; }));
        return txRows;
    },
    sortNameChildAggregators = function (aggs) {
        aggs.sort(utils.compareFunction(false, function (agg) { return agg.sum; }));
        return aggs;
    },
    sortNetChildAggregators = function (aggs) {
        aggs.sort(utils.compareFunction(false, function (agg) { return agg.sortOrder; }));
        return aggs;
    },
    entityNameChildAggregator = function (parentAggregator, tx) {
        var childAggregators = parentAggregator.childAggregators;
        var categoryPath = tx.correctedValues.categoryPath;

        var aggregatorName, aggregatorTitle, categoryDepth;
        if (categoryPath && categoryPath.length) {
            categoryDepth = parentAggregator.categoryDepth === undefined ? 0 : parentAggregator.categoryDepth + 1;
            if (categoryDepth < categoryPath.length) {
                aggregatorName = "CAT_" + categoryPath[categoryDepth]; //avoid name collisons
                aggregatorTitle = categoryPath[categoryDepth];
            }
            else {
                categoryDepth = undefined;
            }
        }

        if (categoryDepth === undefined) {
            aggregatorName = "NAM_" + tx.correctedValues.entityNameBest;
            aggregatorTitle = tx.correctedValues.entityNameBest;
        }

        var aggregator = childAggregators[aggregatorName];
        if (!aggregator) {
            if (categoryDepth !== undefined) {
                aggregator = new TransactionAggregator(parentAggregator, aggregatorName, aggregatorTitle, false, entityNameChildAggregator, sortNameChildAggregators, sortTxRows, true);
                aggregator.categoryDepth = categoryDepth;
            }
            else {
                aggregator = new TransactionAggregator(parentAggregator, aggregatorName, aggregatorTitle, true, undefined, sortNameChildAggregators, sortTxRows, false);
            }

            childAggregators[aggregatorName] = aggregator;
        }

        return aggregator;
    },
    getExpenseChildAggregator = function expense(parentAggregator) {
        var agg = new TransactionAggregator(parentAggregator, "Expense", "Expenses", false, entityNameChildAggregator, sortNameChildAggregators, sortTxRows, false);
        agg.sortOrder = 1; //Show it after income

        return agg;
    },
    getIncomeChildAggregator = function income(parentAggregator) {
        var agg = new TransactionAggregator(parentAggregator, "Income", "Income", false, entityNameChildAggregator, sortNameChildAggregators, sortTxRows, false);
        agg.sortOrder = 0; //Show it first (because it has smaller line items)

        return agg;
    },
    getTransfersChildAggregator = function transfers(parentAggregator) {
        var agg = new TransactionAggregator(parentAggregator, "Transfers", "Transfers", false, entityNameChildAggregator, sortNameChildAggregators, sortTxRows, false);
        agg.sortOrder = 10; //Show it at the end

        return agg;
    };

    var incomeExpenseChildAggregatorMapping = {
        "0": getExpenseChildAggregator,   //Purchase
        "1": getExpenseChildAggregator, //Adjustment
        "2": getExpenseChildAggregator, //Fee
        "4": getTransfersChildAggregator, //InterAccountPayment
        "8": getExpenseChildAggregator, //Return
        "16": getTransfersChildAggregator, //InterAccountTransfer
        "32": getIncomeChildAggregator,
        "64": getIncomeChildAggregator,
        "128": getExpenseChildAggregator,
        "256": getIncomeChildAggregator,
        "512": getExpenseChildAggregator,
        "1024": getIncomeChildAggregator,
        "2048": getExpenseChildAggregator
    };

    var incomeExpenseChildAggregator = function (parentAggregator, tx) {
        var aggregatorFunction = incomeExpenseChildAggregatorMapping[tx.correctedValues.transactionReason.toString()] || getExpenseChildAggregator;
        var childAggregators = parentAggregator.childAggregators;
        if (!childAggregators[aggregatorFunction.name]) {
            childAggregators[aggregatorFunction.name] = aggregatorFunction(parentAggregator);
        }

        return childAggregators[aggregatorFunction.name];
    };

    var $this = function (txItems, txItemsKey) {
        this.aggregator = new TransactionAggregator(undefined, "Net." + txItemsKey, "Net/Net", false,
                            incomeExpenseChildAggregator, sortNetChildAggregators, sortTxRows, false);

        utils.forEach(txItems, function (tx) {
            this.aggregator.add(tx);
        }, this);

        this.aggregator.finalize();
    };

    var proto = {

    };

    proto.constructor = $this;
    $this.prototype = proto;

    return $this;
});