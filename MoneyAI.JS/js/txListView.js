define("TxListView", ["jquery", "Transaction", "common/utils", "EditedValues", "common/popoverForm", "knockout", "NetAggregator",
    "text!templates/txList.html", "text!templates/noteEditorBody.html", "text!templates/categoryEditorBody.html",
    "text!templates/txAttributesEditorBody.html", "text!templates/saveEditsConfirmModal.html"],
    function ($, Transaction, utils, editedValues, popoverForm, ko, NetAggregator,
        txListTemplateHtml, noteEditorBodyHtml, categoryEditorBodyHtml, txAttributesEditorBodyHtml, saveEditsConfirmModalHtml) {

    "use strict";

    var compiledTemplates = {},   //cache compiled template
        optionsDefaults = {
            enableGrouping: true,
            enableEdits: true,
            enableKeyboardShortcuts: false, //true for multiple grids can be dangerous
            enableIndicators: true //flag, note indicators next to name
        },
        saveConfirmModalId = 0;

    var initialize = function (element, options) {
        var self = this;
        self.cachedValues = undefined;
        self.hostElement = element;
        self.options = utils.extend({}, optionsDefaults, options);
        self.tableSelection = {};

        //Clicks for +/- buttons
        self.hostElement.on("click", ".txRowExpanderControl", function (event) {   //NOTE: jquery live events don"t bubble up in iOS except for a and button elements
            var parentRow = $(this).closest("tr");
            var isChildrenVisible = parentRow.data("ischildrenvisible").toString() === "true";

            collapseExpandRows.call(self, parentRow, !isChildrenVisible);

            event.preventDefault(); //Prevent default behavior or link click and avoid bubbling
        });

        //Row mouse clicks
        self.hostElement.on("click", ".txDataGridBody > tr", function () {
            var row = $(this);
            self.setTableSelection(row);
         });

        var keyUpOccured = true;    //Flag to detect multiple events in keydown
        //Left & Right arrow key
        $(document).on("keyup", function (e) {
            var row = self.tableSelection.rowElement;
            keyUpOccured = true;
            if (row && !utils.isInputElementInFocus() && self.options.enableKeyboardShortcuts && self.isActive) {
                var isMeta = (e.metaKey || e.altKey);

                if (e.which === 37 || e.which === 39) { //left & right arrows
                    if (row.attr("data-ischildrenvisible") !== undefined) {  //Only fire for groups
                        collapseExpandRows.call(self, row, e.which === 39, e.which === 39 && isMeta); //last parameter for expand/collapse all levels
                        e.preventDefault();
                    }
                }
            }
        });
        //Up/down arrow key on table
        $(document).on("keydown", function (e) {
            var row = self.tableSelection.rowElement;
            if (row && !utils.isInputElementInFocus() && self.options.enableKeyboardShortcuts && self.isActive) {
                var isMeta = (e.metaKey || e.altKey);

                if (e.which === 38 || e.which === 40) { //up and down arrows
                    var newSelectedRow = e.which === 40 ? utils.nextVisibleSibling(row, "txRowInvisible") :
                            utils.prevVisibleSibling(row, "txRowInvisible");

                    //If no current row then event will be ignored (user must click on a row first to start selection
                    if (newSelectedRow && newSelectedRow.length > 0) {
                        var previousRow = self.setTableSelection(newSelectedRow);

                        if (previousRow && utils.isElementInView(newSelectedRow)) {
                            e.preventDefault();

                            var newScrollPosition = $(window).scrollTop() + (previousRow.height() * (e.which === 40 ? 1 : -1));
                            $(window).scrollTop(newScrollPosition);
                        }
                    }
                    //else leave current selection alone
                }
                else if (isMeta && e.which === 78 && keyUpOccured) { //Meta+N
                    if (clickEditCommand.call(self, row, "editNote")) {
                        utils.cancelRestOfTheHandlers(e);
                    }
                }
                else if (isMeta && e.which === 84 && keyUpOccured) { //Meta+T
                    if (clickEditCommand.call(self, row, "editCategory")) {
                        utils.cancelRestOfTheHandlers(e);
                    }
                }
                else if (isMeta && e.which === 69 && keyUpOccured) { //Meta+E
                    if (clickEditCommand.call(self, row, "fixAttributeErrors")) {
                        utils.cancelRestOfTheHandlers(e);
                    }
                }
                else if (isMeta && e.which === 70 && keyUpOccured) { //Meta+F, Meta+Shift+F
                    if (clickEditCommand.call(self, row, "setFlag", { isSet: !!!e.shiftKey })) {
                        utils.cancelRestOfTheHandlers(e);
                    }
                }

                if (e.isDefaultPrevented()) {
                    keyUpOccured = false;
                }
            }
        });

        //Clicks for set note menu
        self.hostElement.on("click", "[data-menuitem]", function (event) {
            var menuItemElement = $(this),
            menuItem = menuItemElement.data("menuitem"),
            menuParams = menuItemElement.data("menuparams"),
            row = menuItemElement.closest("tr");

            clickEditCommand.call(self, row, menuItem, menuParams);

            event.preventDefault(); //Prevent default behavior or link click and avoid bubbling
        });

        //Hookup keyboard shortcuts

    };

    
    var TxListView = function (element, options) {
        initialize.call(this, element, options);
    };

    var getRowInfo = function (row) {
        var self = this, rowInfo = { row: row };

        //Is this group row?
        rowInfo.groupId = row.data("groupid");
        if (rowInfo.groupId !== undefined) {
            rowInfo.aggregator = self.cachedValues.netAggregator.getByGroupId(rowInfo.groupId);
            rowInfo.txs = rowInfo.aggregator.getAllTx();
        }
        else {
            rowInfo.txId = row.data("txid");

            if (rowInfo.txId !== undefined) {
                rowInfo.tx = self.cachedValues.txs.itemsById.get(rowInfo.txId);
                rowInfo.txs = [rowInfo.tx];
            }
        }

        return rowInfo;
    },
    getRowFromRowInfo = function (rowInfo) {
        if (!rowInfo) {
            return undefined;
        }

        var self = this;

        //rowInfo.row may be old and could have been discarded by refresh

        var selector;   //leave it undefined
        if (rowInfo.groupId !== undefined) {
            selector = ".txDataGridBody > tr[data-groupid=\"" + rowInfo.groupId + "\"]";
        }
        else if (rowInfo.txId !== undefined) {
            selector = ".txDataGridBody > tr[data-txid=\"" + rowInfo.txId + "\"]";
        }

        return selector ? self.hostElement.find(selector).first() : undefined;
    },
    getGroupRowInfo = function (row) {
        var self = this;

        var rowInfo = getRowInfo.call(self, row);
        if (rowInfo.groupId === undefined) {
            return undefined;
        }
        else {
            rowInfo.childRows = row.nextAll("tr[data-parentgroupid=\"" + rowInfo.groupId + "\"]");
            rowInfo.expanderTitle = row.find(".expanderTitle");

            return rowInfo;
        }
    },
    clickEditCommand = function (row, commandName, commandParams) {
        var self = this;

        var rowInfo = getRowInfo.call(self, row),
            selectedTx = rowInfo.txs;

        if (selectedTx) {
            var dropdownContainer = row.find(".dropdown").last(),
                dropdownElement = dropdownContainer.find(".dropdown-toggle").first();

            if (dropdownContainer.hasClass("open")) {   //Bootstrap dropdown does not have hide method so this is a hack
                dropdownElement.dropdown("toggle");
            }

            switch (commandName) {
                case "setFlag": setFlagMenuItemClick.call(self, commandParams, selectedTx, dropdownElement); break;
                case "editNote": editNoteMenuItemClick.call(self, commandParams, selectedTx, dropdownElement); break;
                case "editCategory": editCategoryMenuItemClick.call(self, commandParams, selectedTx, dropdownElement); break;
                case "fixAttributeErrors": fixAttributeErrorsMenuItemClick.call(self, commandParams, selectedTx, dropdownElement); break;
                default:
                    throw new Error("Command " + commandName + " is not supported");
            }

            return true;
        }

        return false;
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
    showHideRow = function (rowInfo, forceAllLevels) {
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
            var childRowInfo = getGroupRowInfo.call(self, row);
            if (childRowInfo === undefined) {
                updateRowVisibilityAttribute.call(self, row, rowInfo.aggregator.isTxVisible || forceAllLevels);
            }
            else {
                showHideRow.call(self, childRowInfo, forceAllLevels);
            }
        });
    },
    collapseExpandRows = function (parentRow, isChildrenVisible, forceAllLevels) {
        var self = this;

        var rowInfo = getGroupRowInfo.call(self, parentRow);
        if (rowInfo === undefined) {    //Tx rows
            return;
        }

        rowInfo.aggregator.setChildrenVisible(isChildrenVisible);
        parentRow.data("ischildrenvisible", isChildrenVisible.toString());

        showHideRow.call(self, rowInfo, forceAllLevels);
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
                    
                    isAffactedTransactionsShown: ko.observable(false),
                    showAffactedTransactions: function () {
                        var affectedTransactionsContainer = modalTarget.find(".affactedTransactionsContainer").first();
                        var affectedTransactionsListView = new TxListView(affectedTransactionsContainer, {
                            enableGrouping: false, enableEdits: false, enableIndicators: false
                        });

                        var flattenedTx = [];
                        utils.forEach(allAffectedTransactions, function (editTx) { flattenedTx = flattenedTx.concat(editTx.affectedTransactions); });

                        affectedTransactionsListView.refresh(self.cachedValues.txs, flattenedTx, "");
                        viewModel.isAffactedTransactionsShown(true);
                    },

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
        var self = this;
        return self.cachedValues.txs.addUpdateEdit(lastEdit, scopeFilters, userEditableFieldsModel, utils.bind(defaultReviewAffectedTransactionsCallback, self));
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
            .popoverForm(bodyHtml, viewModel, {
                titleIconClass: formIconClass,
                titleText: getTitle(lastEdit, selectedTx),
                onOk: onSaveWrapper,
                afterClose: afterCloseHandler
            });
        }
        else {
            //No UI, run Save directly
            onSaveWrapper()
            .done(function () { afterCloseHandler(true); })
            .fail(function () { afterCloseHandler(false); });
        }
    },
    
    //Menu click events
    fixAttributeErrorsMenuItemClick = function (menuParams, selectedTx, dropdownElement) {
        getRuleBasedMenuItemClickHandler.call(this, menuParams, selectedTx, dropdownElement,
            function (lastEdit, selectedTx) {
                var transactionReasonLookup = selectedTx.length > 1 ?
                        Transaction.prototype.transactionReasonPluralTitleLookup : Transaction.prototype.transactionReasonTitleLookup,
                    allTransactionReasons = utils.toKeyValueArray(transactionReasonLookup);

                return {
                    allTransactionReasons: allTransactionReasons,

                    isAmountChanged: ko.observable(lastEdit.values.amount !== undefined),
                    amount: lastEdit.values.amount ? lastEdit.values.amount.value :
                        utils.mostOccuring(selectedTx, function (tx) { return tx.correctedValues.amount; }),

                    isTransactionReasonChanged: ko.observable(lastEdit.values.transactionReason !== undefined),
                    transactionReason: utils.findFirst(allTransactionReasons, function (arrayItem) {
                        return (lastEdit.values.transactionReason ? lastEdit.values.transactionReason.value :
                        utils.mostOccuring(selectedTx, function (tx) { return tx.correctedValues.transactionReason; })).toString() === arrayItem.key;
                    }),

                    isEntityNameChanged: ko.observable(lastEdit.values.entityName !== undefined),
                    entityName: lastEdit.values.entityName ? lastEdit.values.entityName.value :
                        utils.mostOccuring(selectedTx, function (tx) { return tx.correctedValues.entityNameBest; })
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
    },
        
    setTableRowSelectionStyle = function (rowElement, isSelected) {
        if (rowElement) {
            if (isSelected) {
                rowElement.addClass("selectedTableRow");
            }
            else {
                rowElement.removeClass("selectedTableRow");
            }
        }
    };


    //publics
    var proto = {
        refresh: function (txs, txItems, txItemsKey) {
            var self = this;

            if (txs) {
                self.cachedValues = { txs: txs, txItems: txItems, txItemsKey: txItemsKey };
                self.tableSelection = {};
            }

            var oldRowInfo = self.tableSelection && self.tableSelection.rowElement ?
                getRowInfo.call(self, self.tableSelection.rowElement) : undefined;

            //Always update aggregator because tx data might have changed
            self.cachedValues.netAggregator = (new NetAggregator(self.cachedValues.txItems, self.cachedValues.txItemsKey, self.options)).aggregator;

            compiledTemplates.txListTemplate = compiledTemplates.txListTemplate || utils.compileTemplate(txListTemplateHtml);
            var templateHtml = utils.runTemplate(compiledTemplates.txListTemplate, self.cachedValues.netAggregator);
            self.hostElement.html(templateHtml);

            var newSelectedRow = getRowFromRowInfo.call(self, oldRowInfo);
            self.setTableSelection(newSelectedRow);
        },

        setTableSelection: function (row) {
            var self = this;

            row = row && row.length > 0 ? row : undefined;

            var previousElement = self.tableSelection.rowElement;
            setTableRowSelectionStyle.call(self, previousElement, false);
            setTableRowSelectionStyle.call(self, row, true);
            self.tableSelection.rowElement = row;

            if (row) {
                var rowInfo = getRowInfo.call(self, row);
                if (rowInfo.groupId) {
                    utils.triggerEvent(self, "transactionAggregateSelected", [rowInfo.aggregator, row, rowInfo.txs]);
                }
                else {
                    if (rowInfo.txId) {
                        utils.triggerEvent(self, "transactionRowSelected", [rowInfo.tx, row]);
                    }
                    else {
                        utils.triggerEvent(self, "transactionRowSelected", [null, row]);
                    }
                }
            }

            return previousElement;
        },
        isActive: true
    };

    proto.constructor = TxListView;
    TxListView.prototype = proto;

    return TxListView;
});