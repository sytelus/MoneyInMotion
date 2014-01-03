define("txListView", ["jquery", "Transaction", "common/utils", "TransactionAggregator", "EditedValues", "common/popoverForm", "knockout",
    "text!templates/txList.html", "text!templates/noteEditorBody.html", "text!templates/categoryEditorBody.html",
    "text!templates/txAttributesEditorBody.html", "text!templates/saveEditsConfirmModal.html"],
    function ($, Transaction, utils, TransactionAggregator, editedValues, popoverForm, ko,
        txListTemplateHtml, noteEditorBodyHtml, categoryEditorBodyHtml, txAttributesEditorBodyHtml, saveEditsConfirmModalHtml) {

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
    updateRowVisibilityAttribute = function (row, isVisible) {
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

    defaultReviewAffectedTransactionsCallback = function (allAffectedTransactions, allAffectedTransactionsCount) {
        if (allAffectedTransactionsCount !== 1) {
            compiledTemplates.saveEditsConfirmModalTemplate = compiledTemplates.saveEditsConfirmModalTemplate || utils.compileTemplate(saveEditsConfirmModalHtml);
            var templateHtml = utils.runTemplate(compiledTemplates.saveEditsConfirmModalTemplate);
            var container = $("#txListConfirmEditSaveModalContainer").html(templateHtml);

            var modalTarget = container.children("#txListConfirmEditSaveModal");
            modalTarget = modalTarget.modal();

            var deferredPromise = utils.createDeferred(),
                viewModel = {
                    allAffectedTransactions: allAffectedTransactions,
                    allAffectedTransactionsCount: allAffectedTransactionsCount,
                    onOk: function () {
                        //Resolve only after hide or elements would be recreated
                        modalTarget.one("hidden.bs.modal", function () { deferredPromise.resolve(); });
                        modalTarget.modal("hide");
                    },
                    onCancel: function () {
                        //Resolve only after hide or elements would be recreated
                        modalTarget.one("hidden.bs.modal", function () { deferredPromise.resolve(); });
                        modalTarget.modal("hide");
                    }
            };

            ko.applyBindings(viewModel, modalTarget[0]);

            return deferredPromise.promise();
        }
        
        return true;
    },

    defaultOnSaveHandler = function (lastEdit, scopeFilters, userEditableFieldsModel) {
        return cachedValues.txs.addUpdateEdit(lastEdit, scopeFilters, userEditableFieldsModel, defaultReviewAffectedTransactionsCallback);
    },

    getRuleBasedMenuItemClickHandler = function (menuParams, selectedTx, dropdownElement,
        toUserEditableFields, fromUserEditableFields, getTitle, formIconClass, formBodyHtml,
        lastEditFilter, defaultEditScopeType, defaultEditScopeParameters, onSave) {

        var lastEdits = cachedValues.txs.getLastEdit(selectedTx, lastEditFilter, defaultEditScopeType, defaultEditScopeParameters);
        var lastEdit = lastEdits[0];    //choose one if there are conflicting edits

        var viewModel = {
            selectedTx: selectedTx,
            scopeTypeLookup: editedValues.scopeTypeLookup,
            lastEdits: lastEdits,
            lastEdit: lastEdit,

            //User editable values
            scopeFiltersViewModel: new editedValues.ScopeFiltersViewModel(lastEdit.scopeFilters, selectedTx),
            userEditableFields: toUserEditableFields(lastEdit, selectedTx),
        },
        afterCloseHandler = function (isOkOrCancel) {
            if (isOkOrCancel) {
                refresh();
            }
        };

        var onSaveWrapper = function () {
            return (onSave || defaultOnSaveHandler)(
                lastEdit, viewModel.scopeFiltersViewModel.toScopeFilters(), fromUserEditableFields(viewModel.userEditableFields, lastEdit, selectedTx));
        };

        if (formBodyHtml !== undefined) {
            compiledTemplates[formBodyHtml] = compiledTemplates[formBodyHtml] || utils.compileTemplate(formBodyHtml);
            var bodyHtml = utils.runTemplate(compiledTemplates[formBodyHtml], viewModel); //Render partial templates within templates

            dropdownElement
            .dropdown("toggle")
            .popoverForm(bodyHtml, viewModel, {
                titleIconClass: formIconClass,
                titleText: getTitle(lastEdit, selectedTx),
                onOk: onSaveWrapper,
                afterClose: afterCloseHandler
            });
        }
        else {
            //No UI, run Save directly
            onSaveWrapper();
            afterCloseHandler(true);
        }
    },

    fixAttributeErrorsMenuItemClick = function (menuParams, selectedTx, dropdownElement) {
        getRuleBasedMenuItemClickHandler(menuParams, selectedTx, dropdownElement,
            function (lastEdit, selectedTx) {
                var transactionReasonLookup = selectedTx.length > 1 ?
                        Transaction.prototype.transactionReasonPluralTitleLookup : Transaction.prototype.transactionReasonTitleLookup;

                return {
                    isAmountChanged: ko.observable(lastEdit.values.amount !== undefined),
                    amount: lastEdit.values.amount ? lastEdit.values.amount.value :
                        utils.mostOccuring(selectedTx, function (tx) { return tx.correctedValues.amount; }),

                    isTransactionReasonChanged: ko.observable(lastEdit.values.transactionReason !== undefined),
                    transactionReason: transactionReasonLookup[(lastEdit.values.transactionReason ?
                        lastEdit.values.transactionReason.value :
                        utils.mostOccuring(selectedTx, function (tx) { return tx.correctedValues.transactionReason; })).toString()],

                    isEntityNameChanged: ko.observable(lastEdit.values.entityName !== undefined),
                    entityName: lastEdit.values.entityName ? lastEdit.values.entityName.value :
                        utils.mostOccuring(selectedTx, function (tx) { return tx.correctedValues.entityNameBest; }),

                    allTransactionReasons: utils.toKeyValueArray(transactionReasonLookup)
                };
            },
            function (userEditableFields) {
                return {
                    amount: userEditableFields.isAmountChanged() ? utils.parseFloat(userEditableFields.amount.toString()) : undefined,
                    transactionReason: userEditableFields.isTransactionReasonChanged() ? utils.parseInt(userEditableFields.transactionReason.key) : undefined,
                    entityName: userEditableFields.isEntityNameChanged() ? utils.trim(userEditableFields.entityName) : undefined
                };
            },
            function () { return "Fix Errors"; },
            "fixAttributeErrorsIcon", txAttributesEditorBodyHtml,
            function (edit) { return editedValues.EditedValues.prototype.isUnvoided.call(edit.values, ["entityName", "transactionReason" ,"amount"]); },
            editedValues.scopeTypeLookup.entityNameNormalized, utils.map(utils.distinct(selectedTx, "entityNameNormalized"), "entityNameNormalized")
        );
    },

    editCategoryMenuItemClick = function (menuParams, selectedTx, dropdownElement) {
        getRuleBasedMenuItemClickHandler(menuParams, selectedTx, dropdownElement,
            function (lastEdit, selectedTx) {
                var lastEditCategoryPath = editedValues.EditValue.prototype.getValueOrDefault.call(lastEdit.values.categoryPath);
                return {
                    categoryPathString:
                        lastEditCategoryPath !== undefined ? Transaction.prototype.toCategoryPathString(lastEditCategoryPath) :
                            utils.mostOccuring(selectedTx, function (tx) { return tx.correctedValues.categoryPathString; })
                };
            },
            function (userEditableFields) {
                return {
                    categoryPath: Transaction.prototype.fromCategoryPathString(utils.trim(userEditableFields.categoryPathString))
                };
            },
            function (lastEdit) { return lastEdit.values.categoryPath ? "Edit Category" : "Add Category"; },
            "categoryIcon", categoryEditorBodyHtml,
            function (edit) { return editedValues.EditedValues.prototype.isUnvoided.call(edit.values, "categoryPath"); },
            editedValues.scopeTypeLookup.entityNameNormalized, utils.map(utils.distinct(selectedTx, "entityNameNormalized"), "entityNameNormalized")
        );
    },

    editNoteMenuItemClick = function (menuParams, selectedTx, dropdownElement) {
        getRuleBasedMenuItemClickHandler(menuParams, selectedTx, dropdownElement,
            function (lastEdit, selectedTx) {
                return {
                    note: editedValues.EditValue.prototype.getValueOrDefault.call(lastEdit.values.note,
                        utils.mostOccuring(selectedTx, function (tx) { return tx.correctedValues.note; }))
                };
            },
            function (userEditableFields) {
                return {
                    note: utils.trim(userEditableFields.note)
                };
            },
            function (lastEdit) { return lastEdit.values.note ? "Edit Note" : "Add Note"; },
            "noteIcon", noteEditorBodyHtml,
            function (edit) { return editedValues.EditedValues.prototype.isUnvoided.call(edit.values, "note"); },
            editedValues.scopeTypeLookup.transactionId, utils.map(selectedTx, "id")
        );
    },

    setFlagMenuItemClick = function (menuParams, selectedTx, dropdownElement) {
        var isSet = menuParams.isSet;

        getRuleBasedMenuItemClickHandler(menuParams, selectedTx, dropdownElement,
            function (lastEdit, selectedTx) {
                return {
                    isFlagged: editedValues.EditValue.prototype.getValueOrDefault.call(lastEdit.values.isFlagged,
                        utils.mostOccuring(selectedTx, function (tx) { return tx.correctedValues.isFlagged; }))
                };
            },
            function () { return { isFlagged: isSet }; },
            undefined,  //form title
            undefined, undefined,   //form icon, form HTML
            undefined,  //Last edit filter
            editedValues.scopeTypeLookup.transactionId, utils.map(selectedTx, "id")
        );
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
                    case "fixAttributeErrors": fixAttributeErrorsMenuItemClick(menuParams, selectedTx, dropdownElement); break;
                    default:
                        throw new Error("menuItem " + menuItem + " is not supported");
                }

                event.preventDefault(); //Prevent default behavior or link click and avoid bubbling
            });
        },

        refresh: refresh

    };
});