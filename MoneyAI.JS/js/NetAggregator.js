define("NetAggregator", ["common/utils", "TransactionAggregator", "Transaction", "transactionReasonUtils"], function (utils, TransactionAggregator, Transaction, transactionReasonUtils) {
    "use strict";

    var setCategorySubAggregator = function (parentAggregator, tx) {
        var categoryPath = tx.correctedValues.categoryPath;

        if (categoryPath && categoryPath.length) {
            var categoryDepth = parentAggregator.tag.categoryDepth === undefined ? 0 : parentAggregator.tag.categoryDepth + 1;
            if (categoryDepth < categoryPath.length) {
                var aggregatorName = "CAT_" + categoryPath[categoryDepth]; //avoid name collisons
                var aggregator = parentAggregator.subAggregators[aggregatorName];
                if (!aggregator) {
                    var aggregatorTitle = categoryPath[categoryDepth];
                    aggregator = new TransactionAggregator(parentAggregator, aggregatorName, {
                        title: aggregatorTitle, subAggregateMainTxFunction: entityNameSubAggregator, isCategoryGroup: true
                    });
                    aggregator.tag.categoryDepth = categoryDepth;

                    parentAggregator.subAggregators[aggregatorName] = aggregator;
                }

                return aggregator;
            }
        }

        return undefined;
    },
    entityNameSubAggregator = function (parentAggregator, tx, parents) {
        var aggregator = setCategorySubAggregator(parentAggregator, tx, parents);

        if (!aggregator) {
            //Add subaggregator for name
            var parentsDepth, currentTx = tx, options = {};
            if (parents.length) {
                parentsDepth = parentAggregator.tag.parentsDepth === undefined ? 0 : parentAggregator.tag.parentsDepth + 1;
                if (parentsDepth < parents.length) {
                    currentTx = parents[parentsDepth];
                    options.subAggregateMainTxFunction = entityNameSubAggregator;
                }
            }

            var aggregatorName = "NAM_" + currentTx.correctedValues.entityNameBest;
            aggregator = parentAggregator.subAggregators[aggregatorName];
            if (!aggregator) {
                options.title = currentTx.correctedValues.entityNameBest;
                aggregator = new TransactionAggregator(parentAggregator, aggregatorName, options);
                aggregator.tag.parentsDepth = parentsDepth;
                parentAggregator.subAggregators[aggregatorName] = aggregator;
            }
        }

        return aggregator;
    },

    //NOTE: Below names determins CSS classes
    getExpenseSubAggregator = function(parentAggregator) {
        var agg = new TransactionAggregator(parentAggregator, "Expenses", { subAggregateMainTxFunction: entityNameSubAggregator} );
        agg.sortOrder = 1; //Show it after income

        return agg;
    },
    getIncomeSubAggregator = function(parentAggregator) {
        var agg = new TransactionAggregator(parentAggregator, "Income", { subAggregateMainTxFunction: entityNameSubAggregator });
        agg.sortOrder = 0; //Show it first (because it has smaller line items)

        return agg;
    },
    getTransfersSubAggregator = function(parentAggregator) {
        var agg = new TransactionAggregator(parentAggregator, "Transfers", { subAggregateMainTxFunction: entityNameSubAggregator });
        agg.sortOrder = 3; //Show it at the end

        return agg;
    },
    getUnmatchedSubAggregator = function(parentAggregator) {
        var agg = new TransactionAggregator(parentAggregator, "Unmatched", { subAggregateMainTxFunction: entityNameSubAggregator });
        agg.sortOrder = 4; //Show it at the end

        return agg;
    };

    var headerSubAggregatorMapping = (function () {
        return utils.toObject(transactionReasonUtils.transactionReasonInfo,
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
        var functionKey = aggregatorFunction.toString();
        if (!subAggregators[functionKey]) {
            subAggregators[functionKey] = aggregatorFunction(parentAggregator);
        }

        return subAggregators[functionKey];
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

    var traverseChilds = function (tx, parents, onLeafCallback) {
        if (utils.isEmpty(tx.children) || tx.hasMissingChild) {
            onLeafCallback(tx, parents);
        }
        else {
            parents.push(tx);
            utils.forEach(tx.children, function (childKvp) { traverseChilds(childKvp.Value, parents, onLeafCallback); });
            parents.pop();
        }
    };

    var $this = function (txs, txItems, txItemsKey, options) {
        var self = this;
        setCategorySubAggregator.txs = txs;
        self.aggregator = new TransactionAggregator(undefined, "Net." + txItemsKey, {
            subAggregateMainTxFunction: options.enableGrouping ? headerSubAggregator : getFlatAggregator(options),
            sortSubAggregatorsFunction: sortHeaderAggregatorsFunction,
            enableEdits: options.enableEdits, enableIndicators: options.enableIndicators, enableExpandCollapse: options.enableGrouping
        });

        var onLeadCallback = function (tx, parents) {
            self.aggregator.add(tx, parents);
        };

        utils.forEach(txItems, function (tx) {
            traverseChilds(tx, [], onLeadCallback);
        });

        this.aggregator.finalize();
    };

    var proto = {

    };

    proto.constructor = $this;
    $this.prototype = proto;

    return $this;
});