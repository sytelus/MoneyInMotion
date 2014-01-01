define("Transactions", ["common/utils", "TransactionEdit", "Transaction", "EditedValues", "userProfile"],
    function (utils, TransactionEdit, Transaction, editedValues, userProfile) {
    "use strict";

    //static privates
    var Transactions = function (jsonData) {
        if (jsonData) {
            utils.extend(this, jsonData);

            this.itemsById = new utils.Dictionary();
            utils.forEach(this.items, function (item) {
                this.itemsById.add(item.id, item);
            }, this);
        }

        this.cachedValues = {};
    };

    var transactionsPrototype = (function () {
        //privates
        //TODO: remove re-parsing parameters on each call
        var filterTransactionByScope = function (scopeFilter, transaction) {
            switch (scopeFilter.type) {
                case editedValues.scopeTypeLookup.all:
                    return true;
                case editedValues.scopeTypeLookup.none:
                    return false;
                case editedValues.scopeTypeLookup.entityName:
                    return utils.any(scopeFilter.parameters, function (param) {
                        return utils.compareStrings(transaction.entityName, param, true, true);
                    });
                case editedValues.scopeTypeLookup.entityNameNormalized:
                    return utils.any(scopeFilter.parameters, function (param) {
                       return utils.compareStrings(transaction.entityNameNormalized, param, true, true);
                    });
                case editedValues.scopeTypeLookup.transactionId:
                    return utils.any(scopeFilter.parameters, function (param) {
                        return utils.compareStrings(transaction.id, param, false);
                    });
                case editedValues.scopeTypeLookup.entityNameAnyTokens:
                    return utils.any(scopeFilter.parameters, function (param) {
                        utils.any(transaction.entityNameTokens, function (entityNameToken) {
                            return utils.compareStrings(entityNameToken, param, true, true);
                        });
                    });
                case editedValues.scopeTypeLookup.entityNameAllTokens:
                    return utils.all(scopeFilter.parameters, function (param) {
                        utils.any(transaction.entityNameTokens, function (entityNameToken) {
                            return utils.compareStrings(entityNameToken, param, true, true);
                        });
                    });
                case editedValues.scopeTypeLookup.accountId:
                    return utils.any(scopeFilter.parameters, function (param) {
                        return utils.compareStrings(transaction.accountId, param, false);
                    });
                case editedValues.scopeTypeLookup.transactionReason:
                    return utils.any(scopeFilter.parameters, function (param) {
                        return transaction.transactionReason === utils.parseInt(param);
                    });
                case editedValues.scopeTypeLookup.amountRange:
                    return transaction.amount >= utils.parseFloat(scopeFilter.parameters[0]) &&
                        transaction.amount <= utils.parseFloat(scopeFilter.parameters[1]);
                default:
                    throw new Error("TransactionEdit.scopeFilter.type " + scopeFilter.type + " is not supported by filterTransactionByScope");
            }
        },

        filterTransactions = function (edit) {
            var filteredTransactions = this.items;

            utils.forEach(edit.scopeFilters, function (scopeFilter) {
                filteredTransactions = utils.filter(filteredTransactions, function (tx) {
                    return filterTransactionByScope(scopeFilter, tx);
                }, this);
            }, this);

            return filteredTransactions;
        },
        
        applyEditsInternal = function (edits, ignoreMissingIds) {
            var editsAffectedCount = 0;
            utils.forEach(edits, function (edit) {
                var affectedTransactions = filterTransactions.call(this, edit);
                
                //TODO: convert to warning
                if (affectedTransactions.length > 100 || affectedTransactions.length === 0) {
                    throw new Error("This edit modified " + affectedTransactions.length + " which does not look correct");
                }
                
                var editAffectedCount = 0;
                utils.forEach(affectedTransactions, function (tx) {
                    Transaction.prototype.applyEdit.call(tx, edit);
                    editAffectedCount++;
                }, this);

                if (!!!ignoreMissingIds && edit.scopeFilters.length === 1 && edit.scopeFilters[0].type === editedValues.scopeTypeLookup.transactionId) {
                    if (editAffectedCount !== edit.scopeFilters[0].parameters.length) {
                        throw new Error("Edit targetted transactions with " + edit.scopeFilters[0].parameters.length + " IDs but only " + editAffectedCount + " were found in this collection");
                    }
                }

                editsAffectedCount += editAffectedCount;
            }, this);

            utils.triggerEvent(this, "editsApplied", [edits, editsAffectedCount]);

            return editsAffectedCount;
        },

        ensureEditsByIdCache = function() {
            if (!this.cachedValues.editsById) {
                this.cachedValues.editsById = {};

                utils.forEach(this.edits.edits, function(edit) { this.cachedValues.editsById[edit.id.toString()] = edit; }, this);
            }
        },

        addEditForScopeType = function (scopeType, scopeParameters) {
            var scopeFilter = new editedValues.EditScope(scopeType, scopeParameters);
            return addEdit.call(this, [scopeFilter]);
        },
        
        addEdit = function (scopeFilters) {
            var edit = new TransactionEdit(scopeFilters, userProfile.getEditsSourceId());
            this.edits.edits.push(edit);

            ensureEditsByIdCache.call(this);
            this.cachedValues.editsById[edit.id.toString()] = edit;

            return edit;
        };


        //publics
        return {
            setIsUserFlagged: function (ids, isUserFlagged) {
                var isFlaggedEditValue = isUserFlagged !== undefined ?
                    (new editedValues.EditValue(isUserFlagged)) :
                    editedValues.EditValue.voidedEditValue(false);

                var edits = utils.map(ids, function (id) {
                    var edit = addEditForScopeType.call(this, editedValues.scopeTypeLookup.transactionId, [id]);
                    edit.values.isFlagged = isFlaggedEditValue;
                    return edit;
                }, this);

                return applyEditsInternal.call(this, edits);
            },

            setNote: function (ids, note, isRemove) {
                var noteEditValue = !!!isRemove ?
                    (new editedValues.EditValue(note)) :
                    editedValues.EditValue.voidedEditValue(false);

                var edits = utils.map(ids, function (id) {
                    var edit = addEditForScopeType.call(this, editedValues.scopeTypeLookup.transactionId, [id]);
                    edit.values.note = noteEditValue;
                    return edit;
                }, this);

                return applyEditsInternal.call(this, edits);
            },

            setCategoryByScope: function (scopeFilteres, categoryPathString, isRemove) {
                var edit = addEdit.call(this, scopeFilteres);

                var categoryPath = Transaction.prototype.getCategoryPath.call(undefined, categoryPathString);

                edit.values.categoryPath = !!!isRemove ?
                    (new editedValues.EditValue(categoryPath)) :
                    editedValues.EditValue.voidedEditValue(false);
                return applyEditsInternal.call(this, [edit]);
            },

            getDefaultCategoryEdit: function(tx) {
                var edit = addEditForScopeType.call(this, editedValues.scopeTypeLookup.entityNameNormalized, [tx.entityNameNormalized]);
                edit.values.categoryPath = tx.correctedValues.categoryPath;
                return edit;
            },

            getEditById: function(editId) {
                ensureEditsByIdCache.call(this);
                return this.cachedValues.editsById[editId.toString()];
            },

            getLastCategoryEdit: function (tx, defaultIfNone) {
                /*jshint -W080 */   //Disable explicit undefined assignment
                var lastCategoryEdit = undefined;
                if (tx.appliedEditIdsDescending) {
                    for (var i = 0; i < tx.appliedEditIdsDescending.length; i++) {
                        var editId = tx.appliedEditIdsDescending[i];
                        var edit = this.getEditById(editId);
                        if (edit === undefined) {
                            throw new Error("Edit for ID " + editId + " was not found");
                        }

                        if (edit.values && edit.values.categoryPath) {
                            lastCategoryEdit = edit;
                            break;
                        }
                    }
                }

                return lastCategoryEdit || (defaultIfNone ? this.getDefaultCategoryEdit(tx) : undefined);
            }
        };
    })();
    transactionsPrototype.constructor = Transactions;
    Transactions.prototype = transactionsPrototype;

    return Transactions;
});