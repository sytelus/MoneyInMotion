﻿define("Transactions", ["common/utils", "TransactionEdit", "Transaction", "EditedValues", "userProfile"],
    function (utils, TransactionEdit, Transaction, editedValues, userProfile) {
    "use strict";

    //static privates
    var addTransactionById = function (transactions, txKvpList) {
        utils.forEach(txKvpList, function (txKvp) {
            var tx = txKvp.Value;
            transactions.itemsById.add(tx.id, tx);
            Transaction.prototype.ensureAllCorrectedValues.call(tx);
        });
    },
    updateCategoryPathCachedValued = function (edit) {
        if (edit.values.categoryPath && edit.values.categoryPath.value && !edit.values.categoryPath.isVoided) {
            var key = utils.map(edit.scopeFilters, "contentHash").join("\t");
            this.cachedValues.categoryPathStrings[key] =
                Transaction.prototype.toCategoryPathString(edit.values.categoryPath.value);
        }
    };

    var Transactions = function (jsonData) {
        if (jsonData) {
            utils.extend(this, jsonData);

            this.itemsById = new utils.Dictionary();
            addTransactionById(this, this.items);

            this.items = utils.map(utils.filter(this.items, function (item) { return !!!item.Value.parentId; }),
                function (item) { return item.Value; });
        }

        this.cachedValues = { editsById: {} };
        utils.forEach(this.edits.edits, function (edit) { this.cachedValues.editsById[edit.id.toString()] = edit; }, this);

        this.cachedValues.categoryPathStrings = {};
        utils.forEach(this.edits.edits, updateCategoryPathCachedValued, this);
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
                        return utils.any(transaction.entityNameTokens, function (entityNameToken) {
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
                    var isNegativeAmount = scopeFilter.parameters[2] === "true";
                    if (isNegativeAmount) {
                        return transaction.amount <= utils.parseFloat(scopeFilter.parameters[0]) * -1 &&
                            transaction.amount >= utils.parseFloat(scopeFilter.parameters[1]) * -1;
                    }
                    else {
                        return transaction.amount >= utils.parseFloat(scopeFilter.parameters[0]) &&
                            transaction.amount <= utils.parseFloat(scopeFilter.parameters[1]);
                    }
                    break;
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

        getAffectedTransactions = function (edits, ignoreMissingIds) {
            var allAffectedTransactions = [];

            utils.forEach(edits, function (edit) {
                var affectedTransactions = filterTransactions.call(this, edit);

                if (!!!ignoreMissingIds && edit.scopeFilters.length === 1 && edit.scopeFilters[0].type === editedValues.scopeTypeLookup.transactionId) {
                    if (affectedTransactions.length !== edit.scopeFilters[0].parameters.length) {
                        throw new Error("Edit targetted transactions with " + edit.scopeFilters[0].parameters.length + " IDs but only " + affectedTransactions.length + " were found in this collection");
                    }
                }

                allAffectedTransactions.push({ edit: edit, affectedTransactions: affectedTransactions });
            }, this);

            return allAffectedTransactions;
        },
        
        applyEditsToAffectedTransactions = function (edits, allAffectedTransactions, allAffectedTransactionsCount) {
            utils.forEach(allAffectedTransactions, function (editTxs) {
                updateCategoryPathCachedValued.call(this, editTxs.edit);

                utils.forEach(editTxs.affectedTransactions, function (tx) {
                    Transaction.prototype.applyEdit.call(tx, editTxs.edit);
                }, this);
            }, this);

            utils.triggerEvent(this, "editsApplied", [edits, allAffectedTransactionsCount]);
        },

        applyEditsInternal = function (edits, ignoreMissingIds, reviewAffectedTransactionsCallback) {
            var self = this;
            var allAffectedTransactions = getAffectedTransactions.call(self, edits, ignoreMissingIds),
                allAffectedTransactionsCount = utils.sum(allAffectedTransactions, function (editTxs) {
                    return editTxs.affectedTransactions.length;
                });

            var reviewResult = true;
            if (reviewAffectedTransactionsCallback) {
                reviewResult = reviewAffectedTransactionsCallback(allAffectedTransactions, allAffectedTransactionsCount);
            }

            var promise = utils.boolToDeferredPromise(reviewResult);
            promise.done(function () {
                applyEditsToAffectedTransactions.call(self, edits, allAffectedTransactions, allAffectedTransactionsCount);
            });

            return promise;
        },

        getScopeFilter = function (scopeType, scopeParameters, scopeReferenceParameters) {
            return new editedValues.EditScope(scopeType, scopeParameters, scopeReferenceParameters);
        },

        addEditForScopeType = function (scopeType, scopeParameters, scopeReferenceParameters) {
            var scopeFilters = [getScopeFilter(scopeType, scopeParameters, scopeReferenceParameters)];
            return addEdit.call(this, scopeFilters);
        },
        
        addEdit = function (scopeFilters) {
            var edit = new TransactionEdit(scopeFilters, userProfile.getEditsSourceId());
            this.edits.edits.push(edit);

            this.cachedValues.editsById[edit.id.toString()] = edit;

            return edit;
        },
        
        getNewEditValue = function (lastEditValue, newValue, isRemove) {
            /*
                Cases:
                    1. newValue is undefined, isRemove = true, -> if lastEditValue is defined create new voided EditValue with lastEditValue as default else error
                    2. newValue is undefined, isRemove = false -> no change, return undefined
                    3. newValue is defined, isRemove = false -> create new EditValue
                    4. newValue is defined, isRemove = true -> create new voided EditValue with newValue as default
            */
            if (newValue === undefined) {
                if (isRemove) {
                    if (lastEditValue) {
                        return new editedValues.EditValue(lastEditValue.value, true);
                    }
                    else {
                        throw new Error("Cannot void edit value if last edit was not defined");
                    }
                }
                else {
                    return undefined;
                }
            }
            else {
                return new editedValues.EditValue(newValue, !!isRemove);
            }
        };


        //publics
        return {
            addUpdateEdit: function (lastEdit, scopeFilteres, newEditedValues, reviewAffectedTransactionsCallback) {
                var edit = addEdit.call(this, scopeFilteres);

                utils.forEach(["entityName", "note"], function (prop) {
                    edit.values[prop] = getNewEditValue(lastEdit[prop], newEditedValues[prop], newEditedValues[prop] === "");
                });
                utils.forEach(["categoryPath"], function (prop) {
                    edit.values[prop] = getNewEditValue(lastEdit[prop], newEditedValues[prop], newEditedValues[prop] === []);
                });
                utils.forEach(["amount", "transactionReason"], function (prop) {
                    edit.values[prop] = getNewEditValue(lastEdit[prop], newEditedValues[prop], newEditedValues[prop] !== undefined && isNaN(newEditedValues[prop]));
                });
                utils.forEach(["isFlagged"], function (prop) {
                    edit.values[prop] = getNewEditValue(lastEdit[prop], newEditedValues[prop], newEditedValues[prop] === null);
                });

                return applyEditsInternal.call(this, [edit], true, reviewAffectedTransactionsCallback);
            },

            //TODO: re-check all code for undefined values, raise errors

            getDefaultEdit: function (defaultEditScopeType, defaultEditScopeParameters, defaultEditScopeReferenceParameters) {
                var edit = addEditForScopeType.call(this, defaultEditScopeType, defaultEditScopeParameters, defaultEditScopeReferenceParameters);
                return edit;
            },

            getEditById: function(editId) {
                return this.cachedValues.editsById[editId.toString()];
            },

            getAllCategoryPathStrings: function() {
                return utils.toValueArray(this.cachedValues.categoryPathStrings);
            },

            getScopeFilter: getScopeFilter,

            getLastEdit: function (selectedTx, lastEditFilter, defaultEditScopeType, defaultEditScopeParameters, defaultEditScopeReferenceParameters) {
                var lastEdits = [];

                if (lastEditFilter) {
                    utils.forEach(selectedTx, function (tx) {
                        if (tx.appliedEditIdsDescending) {
                            for (var i = 0; i < tx.appliedEditIdsDescending.length; i++) {
                                var editId = tx.appliedEditIdsDescending[i];
                                var edit = this.getEditById(editId);
                                if (edit === undefined) {
                                    throw new Error("Edit for ID " + editId + " was not found");
                                }

                                if (edit.values && lastEditFilter(edit)) {
                                    lastEdits.push(edit);
                                }
                            }
                        }
                    }, this);

                    lastEdits = utils.distinct(lastEdits);
                }

                return lastEdits.length > 0 ? lastEdits : (defaultEditScopeType !== undefined ? [this.getDefaultEdit(defaultEditScopeType, defaultEditScopeParameters, defaultEditScopeReferenceParameters)] : undefined);
            },

        };
    })();
    transactionsPrototype.constructor = Transactions;
    Transactions.prototype = transactionsPrototype;

    return Transactions;
});