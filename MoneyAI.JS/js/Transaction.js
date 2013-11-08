﻿define("Transaction", ["common/utils"], function (utils) {
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
                var correctedValue = proto.getMergedEditValue.call(this, name) || this[name];
                return correctedValue;
            });
        };
        
        var correctedValueNames = ["transactionReason", "transactionDate", "amount", "entityName", "isFlagged", "note", "categoryPath"];
        
        //public methods
        //NOTE: We use .call to make calls to other prototype methods because these may get called from 
        //outside on JSON objects
        return {

            TransactionReasonCodes: {
                Purchase: 0,
                Adjustment: 1,
                Fee: 2,
                InterAccountPayment: 4,
                Return: 8,
                InterAccountTransfer: 16
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
                    return correctedEntityName == this.entityName ? this.entityNameNormalized : correctedEntityName;
                });
            },

            ensureAllCorrectedValues: function () {
                if (!this.correctedValues || !this.correctedValues.isPopulated) {

                    var that = this;

                    utils.forEach(correctedValueNames, function (correctedValueName) { getCorrectedValue.call(that, correctedValueName); });

                    proto.getCorrectedTransactionDateParsed.call(this);
                    proto.getTransactionYearString.call(this);
                    proto.getTransactionMonthString.call(this);
                    proto.getEntityNameBest.call(this);

                    memoizeCorrectedValue.call(this, "transactionDisplayText", function () {
                        return utils.formateDate(that.correctedValues.transactionDateParsed, utils.FormatStringDateLocalized);
                    });

                    this.correctedValues.isPopulated = true;
                }
            }
        };
    })();


    proto.constructor = $this;
    
    $this.prototype = proto;

    return $this;
});