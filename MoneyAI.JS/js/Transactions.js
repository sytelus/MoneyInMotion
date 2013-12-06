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
    };

    var transactionsPrototype = (function () {
        //privates
        var filterTransaction = function (edit, transaction) {
            switch (edit.scope.type) {
                case editedValues.scopeTypeLookup.all:
                    return true;
                case editedValues.scopeTypeLookup.none:
                    return false;
                case editedValues.scopeTypeLookup.entityName:
                    return utils.compareStrings(transaction.entityName, edit.scope.parameters[0], true, true);
                case editedValues.scopeTypeLookup.entityNameNormalized:
                    return utils.compareStrings(transaction.entityNameNormalized, edit.scope.parameters[0], true, true);
                case editedValues.scopeTypeLookup.transactionId:
                    return utils.compareStrings(transaction.id, edit.scope.parameters[0], false);
                default:
                    throw new Error("TransactionEdit.scope value of " + edit.scope.type + " is not supported");
            }
        },

        filterTransactions = function (edit) {
            if (edit.scope.type === editedValues.scopeTypeLookup.transactionId) {
                return utils.map(edit.scope.parameters, function (transactionId) {
                    return this.itemsById.get(transactionId);
                }, this);
            }
            else {
                return utils.filter(this.items,
                    function (item) { return filterTransaction(edit, item); }, this);
            }
        },
        
        applyEditInternal = function (edit, ignoreMissingIds) {
            var affectedTransactions = filterTransactions.call(this, edit);
            var count = 0;
            utils.forEach(affectedTransactions, function (tx) {
                Transaction.prototype.applyEdit.call(tx, edit);
                count++;
            });

            if (!!!ignoreMissingIds && edit.scope.type === editedValues.scopeTypeLookup.transactionId) {
                if (count !== edit.scope.parameters.length) {
                    throw new Error("Edit targetted transactions with " + edit.Scope.parameters.length + " IDs but only " + count + " were found in this collection");
                }
            }
        },
        addEditForScope = function (scopeType, scopeParameters) {
            var editScope = new editedValues.EditScope(scopeType, scopeParameters);
            var edit = new TransactionEdit(editScope, userProfile.getEditsSourceId());
            this.edits.edits.push(edit);

            return edit;
        };



        //publics
        return {
            setIsUserFlagged: function (id, isUserFlagged) {
                var edit = addEditForScope.call(this, editedValues.scopeTypeLookup.transactionId, [id]);
                edit.values.isFlagged = isUserFlagged !== undefined ?
                    (new editedValues.EditValue(isUserFlagged)) :
                    editedValues.EditValue.voidedEditValue(false);
                applyEditInternal.call(this, edit);
            },

            setNote: function (id, note, isRemove) {
                var edit = addEditForScope.call(this, editedValues.scopeTypeLookup.transactionId, [id]);
                edit.values.note = !!!isRemove ?
                    (new editedValues.EditValue(note)) :
                    editedValues.EditValue.voidedEditValue(false);
                applyEditInternal.call(this, edit);
            }
        };
    })();
    transactionsPrototype.constructor = Transactions;
    Transactions.prototype = transactionsPrototype;

    return Transactions;
});