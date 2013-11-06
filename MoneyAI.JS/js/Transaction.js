define("Transaction", [], function () {
    "use strict";
    var $this = function Transaction() {
    };

    $this.prototype._memoize = function (key, generatorFunction) {
        this.cachedValues = this.cachedValues || {};
        if (this.cachedValues[key]) {
            return this.cachedValues[key];
        }
        else {
            var value = generatorFunction.call(this);
            this.cachedValues[key] = value;
            return value;
        }
    };

    $this.prototype.getMergedEditValue = function (name) {
        if (this.mergedEdit) {
            if (this.mergedEdit[name]) {
                return this.mergedEdit[name].value;
            }
        }

        return undefined;
    };

    $this.prototype.correctedTransactionDate = function () {
        return $this.prototype._memoize.call(this, "correctedTransactionDate", function () { 
            var transactionDateString = $this.prototype.getMergedEditValue.call(this, "transactionDate") || this.transactionDate;
            return new Date(transactionDateString);
        });
    };

    return $this;
});