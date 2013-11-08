﻿define("TransactionAggregator", ["common/utils", "Transaction"], function (utils, Transaction) {
    "use strict";

    var $this = function TransactionAggregator(name, title, keepRows, childAggregateFunction, sortMapFunction, sortAscending) {
        this.count = 0;
        this.positiveSum = 0;
        this.negativeSum = 0;
        this.sum = 0;

        this.name = name;
        this.title = title;

        this.rows = [];
        this.keepRows = !!keepRows;

        this.childAggregators = {};

        this.childAggregateFunction = childAggregateFunction;
        this.sortMapFunction = sortMapFunction;
        this.sortAscending = sortAscending;
    };

    var proto = (function () {
        //privates
        

        //publics
        return {
            add: function(tx) {
                if (this.keepRows) {
                    this.rows.push(tx);
                }

                Transaction.prototype.ensureAllCorrectedValues.call(tx);

                if (tx.correctedValues.amount > 0) {
                    this.positiveSum += Math.abs(tx.correctedValues.amount);
                }
                else {
                    this.negativeSum += Math.abs(tx.correctedValues.amount);
                }

                this.sum += tx.correctedValues.amount;
                this.count += 1;

                if (this.childAggregateFunction) {
                    var childAggregator = this.childAggregateFunction(this, tx);
                    if (childAggregator) {
                        childAggregator.add(tx);
                    }
                }
            },

            toChildAggregatorsArray: function () {
                var childAggregatorsArray = utils.toValueArray(this.childAggregators);
                childAggregatorsArray.sort(utils.compareFunction(this.sortAscending, this.sortMapFunction));
                return childAggregatorsArray;
            },

            toTxArray: function () {
                this.rows.sort(utils.compareFunction(this.sortAscending, this.sortMapFunction));
                return this.rows;
            }
        };
    })();


    proto.constructor = $this;
    
    $this.prototype = proto;

    return $this;
});