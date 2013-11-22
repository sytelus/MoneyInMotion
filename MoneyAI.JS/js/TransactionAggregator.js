define("TransactionAggregator", ["common/utils", "Transaction"], function (utils, Transaction) {
    "use strict";

    var $this = function TransactionAggregator(parent, name, title, isLeafGroup, childAggregateFunction, sortMapFunction, sortAscending) {
        this.count = 0;
        this.positiveSum = 0;
        this.negativeSum = 0;
        this.sum = 0;

        this.flagCounter = new utils.KeyCounter(true, utils.KeyCounter.booleanKeyMap);
        this.noteCounter = new utils.KeyCounter(true, utils.KeyCounter.booleanKeyMap);
        this.transactionReasonCounter = new utils.KeyCounter(true);
        this.accountCounter = new utils.KeyCounter(true);

        this.depth = parent ? parent.depth + 1 : 0;

        this.name = name;
        this.title = title;

        this.rows = [];
        this.isLeafGroup = !!isLeafGroup;

        this.childAggregators = {};

        this.childAggregateFunction = childAggregateFunction;
        this.sortMapFunction = sortMapFunction;
        this.sortAscending = sortAscending;
    };

    var proto = (function () {
        //privates
        

        //publics
        return {
            add: function (tx) {
                Transaction.prototype.ensureAllCorrectedValues.call(tx);

                if (this.isLeafGroup) {
                    this.rows.push(tx);
                }

                if (tx.correctedValues.amount > 0) {
                    this.positiveSum += Math.abs(tx.correctedValues.amount);
                }
                else {
                    this.negativeSum += Math.abs(tx.correctedValues.amount);
                }

                this.sum += tx.correctedValues.amount;
                this.count += 1;

                this.flagCounter.add(tx.correctedValues.isFlagged);
                this.noteCounter.add(!!tx.correctedValues.note);
                this.transactionReasonCounter.add(tx.correctedValues.transactionReason);
                this.accountCounter.add(tx.accountId);

                if (this.childAggregateFunction) {
                    var childAggregator = this.childAggregateFunction(this, tx);
                    if (childAggregator) {
                        childAggregator.add(tx);
                    }
                }
            },

            finalize: function() {
                this.flagCounter.finalize();
                this.noteCounter.finalize();
                this.transactionReasonCounter.finalize();
                this.accountCounter.finalize();

                utils.forEach(this.childAggregators, function (agg) { agg.finalize(); });
            },

            toChildAggregatorsArray: function () {
                var childAggregatorsArray = utils.toValueArray(this.childAggregators);
                childAggregatorsArray.sort(utils.compareFunction(this.sortAscending, this.sortMapFunction));
                return childAggregatorsArray;
            },

            toTxArray: function () {
                this.rows.sort(utils.compareFunction(this.sortAscending, this.sortMapFunction));
                return this.rows;
            },

            isSingleItem: function () {
                return this.count === 1;
            }
        };
    })();


    proto.constructor = $this;
    
    $this.prototype = proto;

    return $this;
});