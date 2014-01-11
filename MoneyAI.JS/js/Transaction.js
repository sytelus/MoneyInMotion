define("Transaction", ["common/utils", "EditedValues", "userProfile"], function (utils, editedValues, userProfile) {
    "use strict";
    var $this = function Transaction() {
    };

    var proto = (function () {
        //private methods. These must be called using call passing this context
        var memoizeCorrectedValue = function (key, generatorFunction) {
            this.correctedValues = this.correctedValues || {};
            var correctedValue = this.correctedValues[key];
            if (correctedValue) {
                return correctedValue;
            }
            else {
                correctedValue = generatorFunction.call(this);
                this.correctedValues[key] = correctedValue;
                return correctedValue;
            }
        };

        var getCorrectedValue = function (name) {
            return memoizeCorrectedValue.call(this, name, function () {
                var editedValue = proto.getMergedEditValue.call(this, name);
                if (editedValue === undefined) {
                    return this[name];
                }
                else {
                    return editedValue;
                }
            });
        };
        
        var correctedValueNames = ["transactionReason", "transactionDate", "amount", "entityName", "isFlagged", "note", "categoryPath"];
        
        var transactionReasonInfo = [
            { key: "Purchase", value: 0, title: "Purchase", pluralTitle: "Purchases", category: "Expense" },
            { key: "ExpenseAdjustment", value: 1 << 0, title: "Adjustment (Debit)", pluralTitle: "Adjustments (Debit)", category: "Expense" },
            { key: "Fee", value: 1 << 1, title: "Fee", pluralTitle: "Fees", category: "Expense" },
            { key: "InterAccountPayment", value: 1 << 2, title: "Account Payment", pluralTitle: "Account Payments", category: "InterAccount" },
            { key: "Return", value: 1 << 3, title: "Return", pluralTitle: "Returns", category: "Expense" },
            { key: "InterAccountTransfer", value: 1 << 4, title: "Transfer", pluralTitle: "Transfers", category: "InterAccount" },
            { key: "PointsCredit", value: 1 << 5, title: "Points", pluralTitle: "Points", category: "Income" },
            { key: "OtherCredit", value: 1 << 6, title: "Other (Credit)", pluralTitle: "Others (Credit)", category: "Income" },
            { key: "CheckPayment", value: 1 << 7, title: "Check", pluralTitle: "Checks", category: "Expense" },
            { key: "CheckRecieved", value: 1 << 8, title: "Check (Recieved)", pluralTitle: "Checks (Recieved)", category: "Income" },
            { key: "AtmWithdrawal", value: 1 << 9, title: "ATM", pluralTitle: "ATM", category: "Expense" },
            { key: "Interest", value: 1 << 10, title: "Interest", pluralTitle: "Interest", category: "Income" },
            { key: "LoanPayment", value: 1 << 11, title: "Loan", pluralTitle: "Loans", category: "Expense" },
            { key: "DiscountRecieved", value: 1 << 12, title: "Discount", pluralTitle: "Discounts", category: "Expense" },
            { key: "IncomeAdjustment", value: 1 << 13, title: "Adjustment (Credit)", pluralTitle: "Adjustments (Credit)", category: "Income" },
            { key: "MatchAdjustmentCredit", value: 1 << 14, title: "Match Adjustment (Credit)", pluralTitle: "Match Adjustments (Credit)", category: "Expense" },
            { key: "MatchAdjustmentDebit", value: 1 << 15, title: "Match Adjustment (Debit)", pluralTitle: "Match Adjustments (Debit)", category: "Expense" }
        ];

        //public methods
        //NOTE: We use .call to make calls to other prototype methods because these may get called from 
        //outside on JSON objects
        return {
            transactionReasonInfo: transactionReasonInfo,

            transactionReasonTitleLookup: (function () {
                return utils.toObject(transactionReasonInfo,
                    function (item) { return item.value.toString(); },
                    function (item) { return item.title.toString(); });
            })(),

            transactionReasonPluralTitleLookup: (function () {
                return utils.toObject(transactionReasonInfo,
                    function (item) { return item.value.toString(); },
                    function (item) { return item.pluralTitle.toString(); });
            })(),

            transactionReasonCategoryLookup: (function () {
                return utils.toObject(transactionReasonInfo,
                    function (item) { return item.value.toString(); },
                    function (item) { return item.category.toString(); });
            })(),

            getMergedEditValue: function (name) {
                if (this.mergedEdit) {
                    if (this.mergedEdit[name]) {
                        return this.mergedEdit[name].value;
                    }
                }

                return undefined;
            },

            getCorrectedTransactionDateParsed: function () {
                var transactionDateString = getCorrectedValue.call(this, "transactionDate");

                return memoizeCorrectedValue.call(this, "transactionDateParsed", function () {
                    return new Date(transactionDateString);
                });
            },

            getTransactionYearString: function () {
                return memoizeCorrectedValue.call(this, "transactionYearString", function () {
                    var correctedTransactionDate = proto.getCorrectedTransactionDateParsed.call(this);
                    return utils.getYearString(correctedTransactionDate);
                });
            },

            getTransactionMonthString: function () {
                return memoizeCorrectedValue.call(this, "transactionMonthString", function () {
                    var correctedTransactionDate = proto.getCorrectedTransactionDateParsed.call(this);
                    return utils.getMonthString(correctedTransactionDate);
                });
            },

            getEntityNameBest: function() {
                return memoizeCorrectedValue.call(this, "entityNameBest", function () {
                    var correctedEntityName = getCorrectedValue.call(this, "entityName");
                    return correctedEntityName === this.entityName ? this.entityNameNormalized : correctedEntityName;
                });
            },

            getTransactionReasonTitle: function (transactionReason, count) {
                count = count || 0;
                return count > 1 ? proto.transactionReasonPluralTitleLookup[transactionReason.toString()] :
                    proto.transactionReasonTitleLookup[transactionReason.toString()];
            },

            toCategoryPathString: function(categoryPath) {
                return (categoryPath || []).join(" > ");
            },

            fromCategoryPathString: function (categoryPathString) {
                return utils.filter(utils.map((categoryPathString || "").split(">"), function (s) { return utils.trim(s); }), function (s) { return !!s; });
            },

            ensureAllCorrectedValues: function (invalidateExisting) {
                if (invalidateExisting) {
                    this.correctedValues = undefined;
                }

                if (!this.correctedValues || !this.correctedValues.isPopulated) {
                    utils.forEach(correctedValueNames, function (correctedValueName) { getCorrectedValue.call(this, correctedValueName); }, this);

                    proto.getCorrectedTransactionDateParsed.call(this);
                    proto.getTransactionYearString.call(this);
                    proto.getTransactionMonthString.call(this);
                    proto.getEntityNameBest.call(this);

                    if (this.correctedValues.categoryPath) {
                        this.correctedValues.categoryPathString = proto.toCategoryPathString.call(this, this.correctedValues.categoryPath);
                    }
                    
                    this.correctedValues.isPopulated = true;
                }

                if (this.children) {
                    utils.forEach(this.children, function (childTxKvp) {
                        proto.ensureAllCorrectedValues.call(childTxKvp.Value, invalidateExisting);
                    }, this);
                }
            },

            applyEdit: function (edit) {
                if (!this.mergedEdit) {
                    this.mergedEdit = new editedValues.EditedValues(edit.values);
                    this.appliedEditIdsDescending = [];
                }
                else {
                    editedValues.EditedValues.prototype.merge.call(this.mergedEdit, edit.values);
                }

                this.auditInfo = userProfile.updateAuditInfo(this.auditInfo);
                this.appliedEditIdsDescending.unshift(edit.id);

                proto.ensureAllCorrectedValues.call(this, true);
            }
        };
    })();


    proto.constructor = $this;
    
    $this.prototype = proto;

    return $this;
});