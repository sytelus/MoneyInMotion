define("txListView", ["jquery", "Transaction", "common/utils", "text!templates/txList.txt", "text!templates/noteEditorTitle.txt", "text!templates/noteEditorBody.txt", "TransactionAggregator"],
    function ($, Transaction, utils, txListTemplateText, noteEditorTitleText, noteEditorBodyText, TransactionAggregator) {

    "use strict";

    //private statcs
    var cachedValues;
    var compiledTemplates = {};   //cache compiled template
    var lastSelectedYearMonth;

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

    var destoryPopovers = function () {
        $("#txListControl").find(".popover").prev().popover("destroy");
    },

    refresh = function (txs, selectYearString, selectMonthString) {
        if (txs) {
            cachedValues = undefined;
        };

        txs = txs || cachedValues.txs;
        
        selectYearString = selectYearString || lastSelectedYearMonth.yearString;
        selectMonthString = selectMonthString || lastSelectedYearMonth.monthString;

        //first filter out the transactions
        var selectedTxs = utils.filter(txs.items, function (tx) {
            return tx.correctedValues.transactionYearString === selectYearString && tx.correctedValues.transactionMonthString === selectMonthString;
        });

        var netAggregator = new TransactionAggregator(undefined, "Net", "Net/Net", false, incomeExpenseChildAggregator, sortNetChildAggregators, sortTxRows);

        utils.forEach(selectedTxs, function (tx) {
            Transaction.prototype.ensureAllCorrectedValues.call(tx);
            netAggregator.add(tx);
        });

        netAggregator.finalize();

        var templateData = netAggregator;

        compiledTemplates.txListTemplate = compiledTemplates.txListTemplate || utils.compileTemplate(txListTemplateText);
        var templateHtml = utils.runTemplate(compiledTemplates.txListTemplate, templateData);

        $("#txListControl").html(templateHtml);

        cachedValues = { txs: txs, netAggregator: netAggregator };
        lastSelectedYearMonth = { yearString: selectYearString, monthString: selectMonthString };
    },

    editNoteMenuItemClick = function (menuParams, selectedTx, dropdownElement) {
        var firstTx = selectedTx[0];

        compiledTemplates.noteEditorTitle = compiledTemplates.noteEditorTitle || utils.compileTemplate(noteEditorTitleText);
        var titleHtml = utils.runTemplate(compiledTemplates.noteEditorTitle, firstTx);

        compiledTemplates.noteEditorBody = compiledTemplates.noteEditorBody || utils.compileTemplate(noteEditorBodyText);
        var bodyHtml = utils.runTemplate(compiledTemplates.noteEditorBody, firstTx);

        dropdownElement
        .dropdown("toggle")
        .popover({
            animation: false,
            html: true,
            trigger: "manual",
            title: titleHtml,
            content: bodyHtml,
            placement: "bottom"
        })
        .popover("show");

        var popoverContainer = dropdownElement.next();

        popoverContainer.one("click", ".saveControl", function () {
            var note = popoverContainer.find(".noteControl").val();
            var isRemove = popoverContainer.find(".isRemoveControl").is(':checked');
            utils.forEach(selectedTx, function (tx) { cachedValues.txs.setNote(tx.id, note, isRemove); });

            dropdownElement.popover("destroy");

            refresh();
        });

        //Make sure popovers gets killed when hidden
        $("#txListControl").one("hidden.bs.popover", ".dropdown-toggle", function (e) {
            dropdownElement.popover("destroy");
        });

        //Do not refresh or popover will go over
    },

    setFlagMenuItemClick = function (menuParams, selectedTx) {
        var isSet = menuParams.isSet;
        utils.forEach(selectedTx, function (tx) { cachedValues.txs.setIsUserFlagged(tx.id, isSet); });
        refresh();
    };


    //publics
    return {
        initialize: function () {
            cachedValues = undefined;

            //Clicks for +/- buttons
            $("#txListControl").on("click", ".txRowExpanderControl", function (event) {   //NOTE: jquery live events don"t bubble up in iOS except for a and button elements
                var parentRow = $(this).closest("tr");
                var isCollapsed = parentRow.data("iscollapsed").toString() === "true";    //default is undefined

                collapseExpandRows(parentRow, isCollapsed);

                event.preventDefault(); //Prevent default behavior or link click and avoid bubbling
            });

            //Close popovers on ESC
            $(document).on("keyup", function (e) {
                if (e.which === 27) {   //ESC
                    //Destroy potentially open popup
                    destoryPopovers();
                }
            });

            //Clicks for popover close buttons
            $(document).on("click", "[data-dismiss=\"popover\"]", function (e) {
                destoryPopovers();
            });

            //Clicks for set note menu
            $("#txListControl").on("click", "[data-menuitem]", function (event) {
                var menuItemElement = $(this),
                menuItem = menuItemElement.data("menuitem"),
                menuParams = menuItemElement.data("menuparams"),
                cell = menuItemElement.closest("td"),
                dropdownElement = cell.find(".dropdown-toggle").first(),
                row = cell.closest("tr");
                
                //Is this group row?
                var groupId = row.data("groupid");
                var selectedTx;
                if (groupId !== undefined) {
                    var agg = cachedValues.netAggregator.getByGroupId(parseInt(groupId, 10));
                    selectedTx = agg.getAllTx();
                }
                else {
                    var txId = row.data("txid");
                    selectedTx = [cachedValues.txs.itemsById.get(txId)];
                }

                switch (menuItem) {
                    case "setFlag": setFlagMenuItemClick(menuParams, selectedTx, dropdownElement); break;
                    case "editNote": editNoteMenuItemClick(menuParams, selectedTx, dropdownElement); break;
                    default:
                        throw new Error("menuItem " + menuItem + " is not supported");
                }

                event.preventDefault(); //Prevent default behavior or link click and avoid bubbling
            });
        },

        refresh: refresh

    };
});