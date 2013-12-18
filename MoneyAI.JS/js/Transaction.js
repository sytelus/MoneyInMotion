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
        
        //public methods
        //NOTE: We use .call to make calls to other prototype methods because these may get called from 
        //outside on JSON objects
        return {

            transactionReasonReverseLookup: {
                Purchase: 0,
                Adjustment: 1,
                Fee: 2,
                InterAccountPayment: 4,
                Return: 8,
                InterAccountTransfer: 16
            },

            transactionReasonTitleLookup: {
                "0": "Purchase",
                "1": "Adjustment",
                "2": "Fee",
                "4": "Inter Account Payment",
                "8": "Return",
                "16": "Inter Account Transfer"
            },

            transactionReasonPluralTitleLookup: {
                "0": "Purchases",
                "1": "Adjustments",
                "2": "Fees",
                "4": "Inter Account Payments",
                "8": "Returns",
                "16": "Inter Account Transfers"
            },

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

            getCategoryPathString: function(categoryPath) {
                return (categoryPath || []).join(" > ");
            },

            getCategoryPath: function (categoryPathString) {
                return utils.filter(utils.map((categoryPathString || "").split(">"), function (s) { return utils.trim(s); }), function (s) { return !!s; });
            },

            ensureAllCorrectedValues: function (invalidateExisting) {
                if (invalidateExisting) {
                    this.correctedValues = undefined;
                }

                if (!this.correctedValues || !this.correctedValues.isPopulated) {

                    var that = this;

                    utils.forEach(correctedValueNames, function (correctedValueName) { getCorrectedValue.call(that, correctedValueName); });

                    proto.getCorrectedTransactionDateParsed.call(this);
                    proto.getTransactionYearString.call(this);
                    proto.getTransactionMonthString.call(this);
                    proto.getEntityNameBest.call(this);

                    if (this.correctedValues.categoryPath) {
                        this.correctedValues.categoryPathString = proto.getCategoryPathString.call(this, this.correctedValues.categoryPath);
                    }
                    
                    this.correctedValues.isPopulated = true;
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