define("txListView", ["jquery", "Transaction", "common/utils", "TransactionAggregator", "EditedValues", "common/popoverForm",
    "text!templates/txList.html", "text!templates/noteEditorBody.html", "text!templates/categoryEditorBody.html"],
    function ($, Transaction, utils, TransactionAggregator, editedValues, popoverForm,
        txListTemplateHtml, noteEditorBodyHtml, categoryEditorBodyHtml) {

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
                aggregator = new TransactionAggregator(parentAggregator, aggregatorName, aggregatorTitle, false, entityNameChildAggregator, sortNameChildAggregators, sortTxRows, true);
                aggregator.categoryDepth = categoryDepth;
            }
            else {
                aggregator = new TransactionAggregator(parentAggregator, aggregatorName, aggregatorTitle, true, undefined, sortNameChildAggregators, sortTxRows, false);
            }

            childAggregators[aggregatorName] = aggregator;
        }

        return aggregator;
    };

    var getExpenseChildAggregator = function expense(parentAggregator) {
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

    var getRowInfo = function (row) {
        var groupId = row.attr("data-groupid");
        if (groupId === undefined) {
            return undefined;
        }

        var agg = cachedValues.netAggregator.getByGroupId(groupId);
        var childRows = row.nextAll("tr[data-parentgroupid=\"" + groupId + "\"]");
        var expanderTitle = row.find(".expanderTitle");

        return { groupId: groupId, aggregator: agg, childRows: childRows, row: row, expanderTitle: expanderTitle };
    },
    updateRowVisibilityAttribute = function(row, isVisible) {
        if (isVisible) {
            row.removeClass("txRowInvisible");
            row.addClass("txRowVisible");
        }
        else {
            row.removeClass("txRowVisible");
            row.addClass("txRowInvisible");
        }
    },
    showHideRow = function (rowInfo) {
        updateRowVisibilityAttribute(rowInfo.row, rowInfo.aggregator.isVisible);

        if (rowInfo.aggregator.isChildrenVisible) {
            rowInfo.expanderTitle.html("&ndash;");
        }
        else {
            rowInfo.expanderTitle.text("+");
        }

        rowInfo.childRows.each(function () {
            var row = $(this);
            var childRowInfo = getRowInfo(row);
            if (childRowInfo === undefined) {
                updateRowVisibilityAttribute(row, rowInfo.aggregator.isTxVisible);
            }
            else {
                showHideRow(childRowInfo);
            }
        });
    },
    collapseExpandRows = function (parentRow, isChildrenVisible) {
        var rowInfo = getRowInfo(parentRow);
        if (rowInfo === undefined) {    //Tx rows
            return;
        }

        rowInfo.aggregator.setChildrenVisible(isChildrenVisible);
        parentRow.data("ischildrenvisible", isChildrenVisible.toString());

        showHideRow(rowInfo);
    },

    refresh = function (txs, selectYearString, selectMonthString) {
        if (txs) {
            cachedValues = undefined;
        }

        txs = txs || cachedValues.txs;
        
        selectYearString = selectYearString || lastSelectedYearMonth.yearString;
        selectMonthString = selectMonthString || lastSelectedYearMonth.monthString;

        //first filter out the transactions
        var selectedTxs = utils.filter(txs.items, function (tx) {
            return tx.correctedValues.transactionYearString === selectYearString && tx.correctedValues.transactionMonthString === selectMonthString;
        });

        var netAggregator = new TransactionAggregator(undefined, "Net" + "." + selectYearString + "." + selectMonthString,
            "Net/Net", false, incomeExpenseChildAggregator, sortNetChildAggregators, sortTxRows, false);
        utils.forEach(selectedTxs, function (tx) {
            Transaction.prototype.ensureAllCorrectedValues.call(tx);
            netAggregator.add(tx);
        });

        netAggregator.finalize();

        var templateData = netAggregator;

        compiledTemplates.txListTemplate = compiledTemplates.txListTemplate || utils.compileTemplate(txListTemplateHtml);
        var templateHtml = utils.runTemplate(compiledTemplates.txListTemplate, templateData);

        $("#txListControl").html(templateHtml);

        cachedValues = { txs: txs, netAggregator: netAggregator };
        lastSelectedYearMonth = { yearString: selectYearString, monthString: selectMonthString };
    },

    editCategoryMenuItemClick = function (menuParams, selectedTx, dropdownElement) {
        var firstTx = selectedTx[0],
            lastCategoryEdit = cachedValues.txs.getLastCategoryEdit(firstTx, true);

        var viewModel = {
            tx: firstTx,
            selectedTx: selectedTx,
            scopeTypeLookup: editedValues.scopeTypeLookup,

            //User editable values
            scopeFiltersViewModel: new editedValues.ScopeFiltersViewModel(lastCategoryEdit.scopeFilters),
            categoryPathString: firstTx.correctedValues.categoryPathString,

            getTitle: function () {
                return firstTx.correctedValues.categoryPathString ? "Edit Category" : "Add Category";
            },
            save: function (viewModel) {
                cachedValues.txs.setCategoryByScope(viewModel.scopeFiltersViewModel.toScopeFilters(), viewModel.categoryPathString, !!!viewModel.categoryPathString);
            },
            afterClose: function (isOkOrCancel) {
                if (isOkOrCancel) {
                    refresh();
                }
            }
        };

        compiledTemplates.categoryEditorBody = compiledTemplates.categoryEditorBody || utils.compileTemplate(categoryEditorBodyHtml);
        var bodyHtml = utils.runTemplate(compiledTemplates.categoryEditorBody, viewModel); //Render partial templates within templates

        dropdownElement
        .dropdown("toggle")
        .popoverForm(bodyHtml, viewModel, {
            titleIconClass: "categoryIcon",
            titleText: viewModel.getTitle(),
            onSave: viewModel.save,
            afterClose: viewModel.afterClose
        });
    },

    editNoteMenuItemClick = function (menuParams, selectedTx, dropdownElement) {
        var firstTx = selectedTx[0];

        var viewModel = {
            tx: firstTx,
            note: firstTx.correctedValues.note,  //user edited value will go here
            selectedTx: selectedTx,
            getTitle: function() {
                return firstTx.correctedValues.note ? "Edit Note" : "Add Note";
            },
            save: function (viewModel) {
                cachedValues.txs.setNote(utils.map(viewModel.selectedTx, function (tx) { return tx.id; }), viewModel.note, !!!viewModel.note);
            },
            afterClose: function (isOkOrCancel) {
                if (isOkOrCancel) {
                    refresh();
                }
            }
        };

        compiledTemplates.noteEditorBody = compiledTemplates.noteEditorBody || utils.compileTemplate(noteEditorBodyHtml);
        var bodyHtml = utils.runTemplate(compiledTemplates.noteEditorBody, viewModel); //There is no need for this as we don't have partial in this template but we'll follow the pattern

        dropdownElement
        .dropdown("toggle")
        .popoverForm(bodyHtml, viewModel, {
            titleIconClass: "noteIcon",
            titleText: viewModel.getTitle(),
            onSave: viewModel.save,
            afterClose: viewModel.afterClose
        });
    },

    setFlagMenuItemClick = function (menuParams, selectedTx) {
        var isSet = menuParams.isSet;
        cachedValues.txs.setIsUserFlagged(utils.map(selectedTx, function (tx) { return tx.id; }), isSet);
        refresh();
    };


    //publics
    return {
        initialize: function () {
            cachedValues = undefined;

            //Clicks for +/- buttons
            $("#txListControl").on("click", ".txRowExpanderControl", function (event) {   //NOTE: jquery live events don"t bubble up in iOS except for a and button elements
                var parentRow = $(this).closest("tr");
                var isChildrenVisible = parentRow.data("ischildrenvisible").toString() === "true";

                collapseExpandRows(parentRow, !isChildrenVisible);

                event.preventDefault(); //Prevent default behavior or link click and avoid bubbling
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
                    var agg = cachedValues.netAggregator.getByGroupId(groupId);
                    selectedTx = agg.getAllTx();
                }
                else {
                    var txId = row.data("txid");
                    selectedTx = [cachedValues.txs.itemsById.get(txId)];
                }

                switch (menuItem) {
                    case "setFlag": setFlagMenuItemClick(menuParams, selectedTx, dropdownElement); break;
                    case "editNote": editNoteMenuItemClick(menuParams, selectedTx, dropdownElement); break;
                    case "editCategory": editCategoryMenuItemClick(menuParams, selectedTx, dropdownElement); break;
                    default:
                        throw new Error("menuItem " + menuItem + " is not supported");
                }

                event.preventDefault(); //Prevent default behavior or link click and avoid bubbling
            });
        },

        refresh: refresh

    };
});