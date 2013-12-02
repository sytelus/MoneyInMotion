define("Transactions", ["common/utils", "TransactionEdit", "Transaction", "EditedValues"], function (utils, TransactionEdit, Transaction, editedValues) {
    "use strict";

    //static privates
    var Transactions = function () {
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
                    return this.itemsById(transactionId);
                });
            }
            else {
                return utils.filter(this.items,
                    function (item) { return filterTransaction(edit, item); });
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
        initialize = function () {
            this.itemsById = new utils.Dictionary();
            utils.forEach(this.items, function (item) {
                this.itemsById.add(item.id, item);
            });
        },
        addEditForScope = function (scopeType, scopeParameters) {
            var edit = new editedValues.EditScope(scopeType, scopeParameters);
            this.edits.edits.push(edit);

            return edit;
        };



        //publics
        return {
            createFromJson: function (jsonData) {
                var txs = new Transactions();
                utils.extend(txs, jsonData);
                initialize.call(txs);
            },

            setIsUserFlagged: function (tx, isUserFlagged) {
                var edit = addEditForScope.call(this, editedValues.scopeTypeLookup.transactionId, [tx.id]);
                edit.values.isFlagged = isUserFlagged !== undefined ?
                    (new editedValues.EditValue(isUserFlagged)) :
                    editedValues.EditValue.voidedEditValue(false);
                applyEditInternal.call(this, edit);
            }
        };
    })();
    transactionsPrototype.constructor = Transactions;
    Transactions.prototype = transactionsPrototype;

    return Transactions;
});