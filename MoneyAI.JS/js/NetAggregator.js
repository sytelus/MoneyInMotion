define("NetAggregator", ["common/utils", "TransactionAggregator", "Transaction"], function (utils, TransactionAggregator, Transaction) {
    "use strict";

    var entityNameSubAggregator = function (parentAggregator, tx) {
        var subAggregators = parentAggregator.subAggregators;
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

        var aggregator = subAggregators[aggregatorName];
        if (!aggregator) {
            if (categoryDepth !== undefined) {
                aggregator = new TransactionAggregator(parentAggregator, aggregatorName, {
                    title: aggregatorTitle, subAggregateMainTxFunction: entityNameSubAggregator, isCategoryGroup: true
                });
                aggregator.categoryDepth = categoryDepth;
            }
            else {
                aggregator = new TransactionAggregator(parentAggregator, aggregatorName, { title: aggregatorTitle });
            }

            subAggregators[aggregatorName] = aggregator;
        }

        return aggregator;
    },

    //NOTE: Below names determins CSS classes
    getExpenseSubAggregator = function expense(parentAggregator) {
        var agg = new TransactionAggregator(parentAggregator, "Expenses", { subAggregateMainTxFunction: entityNameSubAggregator} );
        agg.sortOrder = 1; //Show it after income

        return agg;
    },
    getIncomeSubAggregator = function income(parentAggregator) {
        var agg = new TransactionAggregator(parentAggregator, "Income", { subAggregateMainTxFunction: entityNameSubAggregator });
        agg.sortOrder = 0; //Show it first (because it has smaller line items)

        return agg;
    },
    getTransfersSubAggregator = function transfers(parentAggregator) {
        var agg = new TransactionAggregator(parentAggregator, "Transfers", { subAggregateMainTxFunction: entityNameSubAggregator });
        agg.sortOrder = 3; //Show it at the end

        return agg;
    },
    getUnmatchedSubAggregator = function unmatched(parentAggregator) {
        var agg = new TransactionAggregator(parentAggregator, "Unmatched", { subAggregateMainTxFunction: entityNameSubAggregator });
        agg.sortOrder = 4; //Show it at the end

        return agg;
    };

    var headerSubAggregatorMapping = (function () {
        return utils.toObject(Transaction.prototype.transactionReasonInfo,
            function(tr) { return tr.value.toString(); },
            function (tr) {
                switch (tr.category) {
                    case "Expense": return getExpenseSubAggregator;
                    case "InterAccount": return getTransfersSubAggregator;
                    case "Income": return getIncomeSubAggregator;
                    default:
                        throw new Error("Child aggregator for category " + tr.category + " is not supported");
                }
            }
        );
    })();

    var headerSubAggregator = function (parentAggregator, tx) {
        var aggregatorFunction;
        
        if (tx.requiresParent && !tx.parentId) {
            aggregatorFunction = getUnmatchedSubAggregator;
        }
        else {
            aggregatorFunction = headerSubAggregatorMapping[tx.correctedValues.transactionReason.toString()];
        }

        var subAggregators = parentAggregator.subAggregators;
        if (!subAggregators[aggregatorFunction.name]) {
            subAggregators[aggregatorFunction.name] = aggregatorFunction(parentAggregator);
        }

        return subAggregators[aggregatorFunction.name];
    },
    sortHeaderAggregatorsFunction = function (aggs) {
        aggs.sort(utils.compareFunction(false, function (agg) { return agg.sortOrder; }));
        return aggs;
    };

    var getFlatAggregator = function (options) {
        var flatAggregatorName = "flatAggregator";

        return function (parentAggregator) {
            var subAggregators = parentAggregator.subAggregators;
            var aggregator = subAggregators[flatAggregatorName];
            if (!aggregator) {
                aggregator = new TransactionAggregator(parentAggregator, flatAggregatorName, {
                    retainChildrenVisibilityState: options.enableGrouping,
                    groupHeaderVisible: options.enableGrouping, enableEdits: options.enableEdits,
                    enableIndicators: options.enableIndicators, enableExpandCollapse: options.enableGrouping,
                    isOptionalGroup: true
                });
                subAggregators[flatAggregatorName] = aggregator;
            }

            return aggregator;
        };
    };

    var $this = function (txItems, txItemsKey, options) {
        this.aggregator = new TransactionAggregator(undefined, "Net." + txItemsKey, {
            subAggregateMainTxFunction: options.enableGrouping ? headerSubAggregator : getFlatAggregator(options),
            sortSubAggregatorsFunction: sortHeaderAggregatorsFunction,
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