define("Transaction", ["utils"], function (utils) {
    "use strict";
    var $this = function Transaction() {
    };

    $this.prototype = (function () {
        //private methods. These must be called using call passing this context
        var memoize = function (key, generatorFunction) {
            this._cachedValues = this._cachedValues || {};
            var cachedValue = this._cachedValues[key];
            if (cachedValue) {
                return cachedValue;
            }
            else {
                cachedValue = generatorFunction.call(this);
                this._cachedValues[key] = cachedValue;
                return cachedValue;
            }
        };

        //public methods
        //NOTE: We use .call to make calls to other prototype methods because these may get called from 
        //outside on JSON objects
        return {
            getMergedEditValue: function (name) {
                if (this.mergedEdit) {
                    if (this.mergedEdit[name]) {
                        return this.mergedEdit[name].value;
                    }
                }

                return undefined;
            },

            getCorrectedTransactionDate: function () {
                return memoize.call(this, "correctedTransactionDate", function () {
                    var transactionDateString = $this.prototype.getMergedEditValue.call(this, "transactionDate") || this.transactionDate;
                    return new Date(transactionDateString);
                });
            },

            getTransactionYearString: function () {
                return memoize.call(this, "transactionYearString", function () {
                    var correctedTransactionDate = $this.prototype.getCorrectedTransactionDate.call(this);
                    return utils.getYearString(correctedTransactionDate);
                });
            },

            getTransactionMonthString: function () {
                return memoize.call(this, "transactionMonthString", function () {
                    var correctedTransactionDate = $this.prototype.getCorrectedTransactionDate.call(this);
                    return utils.getMonthString(correctedTransactionDate);
                });
            }
        };
    })();

    $this.prototype.constructor = $this;

    return $this;
});