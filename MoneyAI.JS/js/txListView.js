define("txListView", ["jquery", "Transaction", "common/utils", "text!templates/txList.txt", "TransactionAggregator"],
    function ($, Transaction, utils, templateText, TransactionAggregator) {

    "use strict";

    //privates
    var compiledTemplate;   //cache compiled template

    var sortTxRows = function (txRows) {
        txRows.sort(utils.compareFunction(false, function (tx) { return tx.amount; }));
        return txRows;
    };
    var sortNameChildAggregators = function (aggs) {
        aggs.sort(utils.compareFunction(false, function (agg) { return agg.sum; }));
        return aggs;
    };
    var sortNetChildAggregators = function (aggs) {
        aggs.sort(utils.compareFunction(false, function (agg) { return agg.sortOrder; }));
        return aggs;
    };

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
                aggregator = new TransactionAggregator(parentAggregator, aggregatorName, aggregatorTitle, false, entityNameChildAggregator, sortNameChildAggregators, sortTxRows);
                aggregator.categoryDepth = categoryDepth;
            }
            else {
                aggregator = new TransactionAggregator(parentAggregator, aggregatorName, aggregatorTitle, true, undefined, sortNameChildAggregators, sortTxRows);
            }

            childAggregators[aggregatorName] = aggregator;
        }

        return aggregator;
    };

    var getExpenseChildAggregator = function expense(parentAggregator) {
        var agg = new TransactionAggregator(parentAggregator, "Expense", "Expenses", false, entityNameChildAggregator, sortNameChildAggregators, sortTxRows);
        agg.sortOrder = 0;

        return agg;
    },
    //getIncomeChildAggregator = function income() {
    //    return new TransactionAggregator(parentAggregator, "Income", "Income", false, entityNameChildAggregator, aggregatorSortMap, false);
    //},
    getTransfersChildAggregator = function transfers(parentAggregator) {
        var agg = new TransactionAggregator(parentAggregator, "Transfers", "Transfers", false, entityNameChildAggregator, sortNameChildAggregators, sortTxRows);
        agg.sortOrder = 10;

        return agg;
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

    var collapseExpandRows = function (parentRow, expand) {
        var groupId = parentRow.attr("data-groupid");
        var childRows = parentRow.nextAll("tr[data-parentgroupid=\"" + groupId + "\"]");
        var expanderTitle = parentRow.find(".expanderTitle");

        if (expand) {
            expanderTitle.html("&ndash;");
            parentRow.data("iscollapsed", "false");
            childRows.each(function () {
                var row = $(this);
                row.removeClass("txRowCollapsed");
                row.addClass("txRowVisible");
                collapseExpandRows(row, expand);
            });
        }
        else {
            expanderTitle.text("+");
            parentRow.data("iscollapsed", "true");
            childRows.each(function () {
                var row = $(this);
                row.removeClass("txRowVisible");
                row.addClass("txRowCollapsed");
                collapseExpandRows(row, expand);
            });
        }
    };

    //publics
    return {
        initialize: function () {
            //Clicks for +/- buttons
            $("#txListControl").delegate(".txRowExpanderControl", "click", function (event) {   //NOTE: jquery live events don"t bubble up in iOS except for a and button elements
                var parentRow = $(this).closest("tr");
                var isCollapsed = parentRow.data("iscollapsed").toString() === "true";    //default is undefined

                collapseExpandRows(parentRow, isCollapsed);

                event.preventDefault(); //Prevent default behavior or link click and avoid bubbling
            });

            //Clicks for set note menu
            $("#txListControl").delegate("[data-target=\"#noteEditorModal\"]", "click", function (event) {
                var element = $(this);
                var txId = element.data("txid");
                $("#noteEditorModal #noteInput").val(txId);
            });
        },

        refresh: function (txs, selectedYear, selectedMonth) {
            //first filter out the transactions
            var selectedTxs = utils.filter(txs.items, function (tx) {
                return tx.correctedValues.transactionYearString === selectedYear && tx.correctedValues.transactionMonthString === selectedMonth;
            });

            var netAggregator = new TransactionAggregator(undefined, "Net", "Net/Net", false, incomeExpenseChildAggregator, sortNetChildAggregators, sortTxRows);

            utils.forEach(selectedTxs, function (tx) {
                Transaction.prototype.ensureAllCorrectedValues.call(tx);
                netAggregator.add(tx);
            });
            
            netAggregator.finalize();

            var templateData = netAggregator;

            compiledTemplate = compiledTemplate || utils.compileTemplate(templateText);
            var templateHtml = utils.runTemplate(compiledTemplate, templateData);

            $("#txListControl").html(templateHtml);
        },


        getTransactionIdsInGroup: function (groupId, allLevels) {
            var parentRows = $("[data-groupid=\"" + groupId + "\"]");
            if (parentRows.length === 0) {
                throw new Error("No table rows found for groupId " + groupId);
            }

            var txIds = [], childRows;

            do {
                parentRows.each(function () {
                    var row = $(this);
                    childRows = parentRows.nextAll("tr[data-parentgroupid=\"" + row.data("groupid") + "\"]");
                    childRows.filter("[data-txid]").each(function () {
                        var row = $(this);
                        txIds.push(row.data("txid"));
                    });
                });

                parentRows = childRows.filter("[data-groupid]");
            } while (parentRows.length > 0 && !!allLevels);

            return txIds;
        }
    };
});