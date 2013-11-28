define("TransactionAggregator", ["common/utils", "Transaction"], function (utils, Transaction) {
    "use strict";

    //static privates
    var nextId = 1;

    var $this = function TransactionAggregator(parent, name, title, retainRows, childAggregateFunction, sortChildAggregatorsFunction, sortTxFunction) {
        this.groupId = nextId++;
        this.parentGroupId = parent ? parent.groupId : -1;

        this.count = 0;
        this.positiveSum = 0;
        this.negativeSum = 0;
        this.sum = 0;

        this.flagCounter = new utils.KeyCounter(true, utils.KeyCounter.booleanKeyMap);
        this.noteCounter = new utils.KeyCounter(true, utils.KeyCounter.booleanKeyMap);
        this.transactionReasonCounter = new utils.KeyCounter(true);
        this.accountCounter = new utils.KeyCounter(true);
        this.transactionDateCounter = new utils.KeyCounter(true);

        this.depth = parent ? parent.depth + 1 : 0;

        this.name = name;
        this.title = title;

        this.rows = [];
        this.retainRows = !!retainRows;

        this.childAggregators = {};

        this.childAggregateFunction = childAggregateFunction;
        this.sortChildAggregatorsFunction = sortChildAggregatorsFunction;
        this.sortTxFunction = sortTxFunction;
    };

    var proto = (function () {
        //privates
        

        //publics
        return {
            add: function (tx) {
                Transaction.prototype.ensureAllCorrectedValues.call(tx);

                if (this.retainRows) {
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
                this.transactionDateCounter.add(tx.correctedValues.transactionDateParsed);

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
                this.transactionDateCounter.finalize();
                
                this.isTopLevel = this.depth == 1;
                this.isTopLevelSelfOrChild = this.depth <= 2;
                this.isSingleItem = this.count == 1;
                this.isSingleItemTopLevelSelfOrChild = this.isSingleItem && this.isTopLevelSelfOrChild;

                utils.forEach(this.childAggregators, function (agg) { agg.finalize(); });
            },

            toChildAggregatorsArray: function () {
                var childAggregatorsArray = utils.toValueArray(this.childAggregators);
                if (this.sortChildAggregatorsFunction) {
                    childAggregatorsArray = this.sortChildAggregatorsFunction(childAggregatorsArray);
                }
                return childAggregatorsArray;
            },

            toTxArray: function () {
                if (this.sortTxFunction) {
                    this.rows = this.sortTxFunction(this.rows);
                }
                return this.rows;
            }
        };
    })();


    proto.constructor = $this;
    
    $this.prototype = proto;

    return $this;
});