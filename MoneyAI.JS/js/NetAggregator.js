define("NetAggregator", ["common/utils", "TransactionAggregator", "Transaction"], function (utils, TransactionAggregator, Transaction) {
    "use strict";

    var entityNameChildAggregator = function (parentAggregator, tx) {
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
                aggregator = new TransactionAggregator(parentAggregator, aggregatorName, { title: aggregatorTitle, childAggregateFunction: entityNameChildAggregator, isCategoryGroup: true });
                aggregator.categoryDepth = categoryDepth;
            }
            else {
                aggregator = new TransactionAggregator(parentAggregator, aggregatorName, { title: aggregatorTitle, retainRows: true });
            }

            childAggregators[aggregatorName] = aggregator;
        }

        return aggregator;
    },
    getExpenseChildAggregator = function expense(parentAggregator) {
        var agg = new TransactionAggregator(parentAggregator, "Expenses", { childAggregateFunction: entityNameChildAggregator} );
        agg.sortOrder = 1; //Show it after income

        return agg;
    },
    getIncomeChildAggregator = function income(parentAggregator) {
        var agg = new TransactionAggregator(parentAggregator, "Income", { childAggregateFunction: entityNameChildAggregator });
        agg.sortOrder = 0; //Show it first (because it has smaller line items)

        return agg;
    },
    getTransfersChildAggregator = function transfers(parentAggregator) {
        var agg = new TransactionAggregator(parentAggregator, "Transfers", { childAggregateFunction: entityNameChildAggregator });
        agg.sortOrder = 3; //Show it at the end

        return agg;
    },
    getUnmatchedChildAggregator = function unmatched(parentAggregator) {
        var agg = new TransactionAggregator(parentAggregator, "Unmatched", { childAggregateFunction: entityNameChildAggregator });
        agg.sortOrder = 4; //Show it at the end

        return agg;
    };

    var headerChildAggregatorMapping = (function () {
        return utils.toObject(Transaction.prototype.transactionReasonInfo,
            function(tr) { return tr.value.toString(); },
            function (tr) {
                switch (tr.category) {
                    case "Expense": return getExpenseChildAggregator;
                    case "InterAccount": return getTransfersChildAggregator;
                    case "Income": return getIncomeChildAggregator;
                    default:
                        throw new Error("Child aggregator for category " + tr.category + " is not supported");
                }
            }
        );
    })();

    var headerChildAggregator = function (parentAggregator, tx) {
        var aggregatorFunction;
        
        if (tx.requiresParent && !tx.parentId) {
            aggregatorFunction = getUnmatchedChildAggregator;
        }
        else {
            aggregatorFunction = headerChildAggregatorMapping[tx.correctedValues.transactionReason.toString()];
        }

        var childAggregators = parentAggregator.childAggregators;
        if (!childAggregators[aggregatorFunction.name]) {
            childAggregators[aggregatorFunction.name] = aggregatorFunction(parentAggregator);
        }

        return childAggregators[aggregatorFunction.name];
    },
    sortHeaderAggregatorsFunction = function (aggs) {
        aggs.sort(utils.compareFunction(false, function (agg) { return agg.sortOrder; }));
        return aggs;
    };

    var getFlatAggregator = function (options) {
        var flatAggregatorName = "flatAggregator";

        return function (parentAggregator) {
            var childAggregators = parentAggregator.childAggregators;
            var aggregator = childAggregators[flatAggregatorName];
            if (!aggregator) {
                aggregator = new TransactionAggregator(parentAggregator, flatAggregatorName, {
                    retainRows: true, retainChildrenVisibilityState: options.enableGrouping,
                    groupHeaderVisible: options.enableGrouping, enableEdits: options.enableEdits,
                    enableIndicators: options.enableIndicators, enableExpandCollapse: options.enableGrouping,
                    isOptionalGroup: true
                });
                childAggregators[flatAggregatorName] = aggregator;
            }

            return aggregator;
        };
    };

    var $this = function (txItems, txItemsKey, options) {
        this.aggregator = new TransactionAggregator(undefined, "Net." + txItemsKey, {
            childAggregateFunction: options.enableGrouping ? headerChildAggregator : getFlatAggregator(options),
            sortChildAggregatorsFunction: sortHeaderAggregatorsFunction,
            enableEdits: options.enableEdits, enableIndicators: options.enableIndicators, enableExpandCollapse: options.enableGrouping
        });

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