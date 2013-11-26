define("Transaction", ["common/utils"], function (utils) {
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

            ensureAllCorrectedValues: function () {
                if (!this.correctedValues || !this.correctedValues.isPopulated) {

                    var that = this;

                    utils.forEach(correctedValueNames, function (correctedValueName) { getCorrectedValue.call(that, correctedValueName); });

                    proto.getCorrectedTransactionDateParsed.call(this);
                    proto.getTransactionYearString.call(this);
                    proto.getTransactionMonthString.call(this);
                    proto.getEntityNameBest.call(this);

                    this.correctedValues.isPopulated = true;
                }
            }
        };
    })();


    proto.constructor = $this;
    
    $this.prototype = proto;

    return $this;
});