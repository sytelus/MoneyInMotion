﻿define("TxListView", ["jquery", "Transaction", "common/utils", "EditedValues", "common/popoverForm", "knockout", "NetAggregator",
    "text!templates/txList.html", "text!templates/noteEditorBody.html", "text!templates/categoryEditorBody.html",
    "text!templates/txAttributesEditorBody.html", "text!templates/saveEditsConfirmModal.html"],
    function ($, Transaction, utils, editedValues, popoverForm, ko, NetAggregator,
        txListTemplateHtml, noteEditorBodyHtml, categoryEditorBodyHtml, txAttributesEditorBodyHtml, saveEditsConfirmModalHtml) {

    "use strict";

    var compiledTemplates = {},   //cache compiled template
        optionsDefaults = {
            enableGrouping: true,
            enableEdits: true,
            enableIndicators: true //flag, note indicators next to name
        },
        saveConfirmModalId = 0;

    var initialize = function (element, options) {
        var self = this;
        self.cachedValues = undefined;
        self.hostElement = element;
        self.options = utils.extend({}, optionsDefaults, options);

        //Clicks for +/- buttons
        self.hostElement.on("click", ".txRowExpanderControl", function (event) {   //NOTE: jquery live events don"t bubble up in iOS except for a and button elements
            var parentRow = $(this).closest("tr");
            var isChildrenVisible = parentRow.data("ischildrenvisible").toString() === "true";

            collapseExpandRows.call(self, parentRow, !isChildrenVisible);

            event.preventDefault(); //Prevent default behavior or link click and avoid bubbling
        });

        //Clicks for set note menu
        self.hostElement.on("click", "[data-menuitem]", function (event) {
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
                var agg = self.cachedValues.netAggregator.getByGroupId(groupId);
                selectedTx = agg.getAllTx();
            }
            else {
                var txId = row.data("txid");
                selectedTx = [self.cachedValues.txs.itemsById.get(txId)];
            }

            switch (menuItem) {
                case "setFlag": setFlagMenuItemClick.call(self, menuParams, selectedTx, dropdownElement); break;
                case "editNote": editNoteMenuItemClick.call(self, menuParams, selectedTx, dropdownElement); break;
                case "editCategory": editCategoryMenuItemClick.call(self, menuParams, selectedTx, dropdownElement); break;
                case "fixAttributeErrors": fixAttributeErrorsMenuItemClick.call(self, menuParams, selectedTx, dropdownElement); break;
                default:
                    throw new Error("menuItem " + menuItem + " is not supported");
            }

            event.preventDefault(); //Prevent default behavior or link click and avoid bubbling
        });
    },
    getRowInfo = function (row) {
        var self = this;

        var groupId = row.attr("data-groupid");
        if (groupId === undefined) {
            return undefined;
        }

        var agg = self.cachedValues.netAggregator.getByGroupId(groupId);
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
        var self = this;
        updateRowVisibilityAttribute.call(self, rowInfo.row, rowInfo.aggregator.isVisible);

        if (rowInfo.aggregator.isChildrenVisible) {
            rowInfo.expanderTitle.html("&ndash;");
        }
        else {
            rowInfo.expanderTitle.text("+");
        }

        rowInfo.childRows.each(function () {
            var row = $(this);
            var childRowInfo = getRowInfo.call(self, row);
            if (childRowInfo === undefined) {
                updateRowVisibilityAttribute.call(self, row, rowInfo.aggregator.isTxVisible);
            }
            else {
                showHideRow.call(self, childRowInfo);
            }
        });
    },
    collapseExpandRows = function (parentRow, isChildrenVisible) {
        var self = this;

        var rowInfo = getRowInfo.call(self, parentRow);
        if (rowInfo === undefined) {    //Tx rows
            return;
        }

        rowInfo.aggregator.setChildrenVisible(isChildrenVisible);
        parentRow.data("ischildrenvisible", isChildrenVisible.toString());

        showHideRow.call(self, rowInfo);
    },

    defaultReviewAffectedTransactionsCallback = function (allAffectedTransactions, allAffectedTransactionsCount) {
        var self = this;

        if (allAffectedTransactionsCount !== 1) {
            compiledTemplates.saveEditsConfirmModalTemplate = compiledTemplates.saveEditsConfirmModalTemplate || utils.compileTemplate(saveEditsConfirmModalHtml);
            var templateHtml = utils.runTemplate(compiledTemplates.saveEditsConfirmModalTemplate);
            var container = self.hostElement.find(".txListConfirmEditSaveModalContainer").html(templateHtml);

            var modalTarget = container.children(".txListConfirmEditSaveModal");
            modalTarget = modalTarget.modal();

            var deferredPromise = utils.createDeferred(),
                viewModel = {
                    allAffectedTransactions: allAffectedTransactions,
                    allAffectedTransactionsCount: allAffectedTransactionsCount,
                    modalId: ++saveConfirmModalId,
                    onOk: function () {
                        //Resolve only after hide or elements would be recreated
                        modalTarget.one("hidden.bs.modal", function () { deferredPromise.resolve(); });
                        modalTarget.modal("hide");
                    },
                    onCancel: function () {
                        //Resolve only after hide or elements would be recreated
                        modalTarget.one("hidden.bs.modal", function () { deferredPromise.reject(); });
                        modalTarget.modal("hide");
                    }
                };

            ko.applyBindings(viewModel, modalTarget[0]);

            return deferredPromise.promise();
        }

        return true;
    },

    defaultOnSaveHandler = function (lastEdit, scopeFilters, userEditableFieldsModel) {
        return this.cachedValues.txs.addUpdateEdit(lastEdit, scopeFilters, userEditableFieldsModel, defaultReviewAffectedTransactionsCallback);
    },

    getRuleBasedMenuItemClickHandler = function (menuParams, selectedTx, dropdownElement,
        toUserEditableFields, fromUserEditableFields, getTitle, formIconClass, formBodyHtml,
        lastEditFilter, defaultEditScopeType, defaultEditScopeParameters, onSave) {

        var self = this;

        var lastEdits = self.cachedValues.txs.getLastEdit(selectedTx, lastEditFilter, defaultEditScopeType, defaultEditScopeParameters);
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
                self.refresh();
            }
        };

        var onSaveWrapper = function () {
            return (onSave || defaultOnSaveHandler).call(self,
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
    
    //Menu click events
    fixAttributeErrorsMenuItemClick = function (menuParams, selectedTx, dropdownElement) {
        getRuleBasedMenuItemClickHandler.call(this, menuParams, selectedTx, dropdownElement,
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
            function (edit) { return editedValues.EditedValues.prototype.isUnvoided.call(edit.values, ["entityName", "transactionReason", "amount"]); },
            editedValues.scopeTypeLookup.entityNameNormalized, utils.map(utils.distinct(selectedTx, "entityNameNormalized"), "entityNameNormalized")
        );
    },

    editCategoryMenuItemClick = function (menuParams, selectedTx, dropdownElement) {
        getRuleBasedMenuItemClickHandler.call(this, menuParams, selectedTx, dropdownElement,
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
        getRuleBasedMenuItemClickHandler.call(this, menuParams, selectedTx, dropdownElement,
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

        getRuleBasedMenuItemClickHandler.call(this, menuParams, selectedTx, dropdownElement,
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

    var $this = function (element) {
        initialize.call(this, element);
    };

    //publics
    var proto = {
        refresh: function (txs, txItems, txItemsKey) {
            var self = this;

            if (txs) {
                self.cachedValues = { txs: txs, txItems:txItems, txItemsKey: txItemsKey };
            }

            //Always update aggregator because tx data might have changed
            self.cachedValues.netAggregator = (new NetAggregator(txItems, txItemsKey, self.options)).aggregator;

            compiledTemplates.txListTemplate = compiledTemplates.txListTemplate || utils.compileTemplate(txListTemplateHtml);
            var templateHtml = utils.runTemplate(compiledTemplates.txListTemplate, self.cachedValues.netAggregator);
            self.hostElement.html(templateHtml);
        }
    };

    proto.constructor = $this;
    $this.prototype = proto;

    return $this;
});