define("TransactionAggregator", ["common/utils"], function (utils) {
    "use strict";

    //static privates
    var allAggregators = {};

    var $this = function TransactionAggregator(parent, name, title, retainRows, childAggregateFunction,
        sortChildAggregatorsFunction, sortTxFunction, isCategoryGroup) {

        this.groupId = (parent ? parent.groupId : "") + "." + name;

        var previousValue = allAggregators[this.groupId];
        this.isChildrenVisible = previousValue ? previousValue.isChildrenVisible : undefined;
        allAggregators[this.groupId] = this;

        this.parent = parent;

        this.count = 0;
        this.positiveSum = 0;
        this.negativeSum = 0;
        this.sum = 0;

        this.flagCounter = new utils.KeyCounter(true, utils.KeyCounter.booleanKeyMap);
        this.noteCounter = new utils.KeyCounter(true);
        this.transactionReasonCounter = new utils.KeyCounter(true);
        this.accountCounter = new utils.KeyCounter(true);
        this.transactionDateCounter = new utils.KeyCounter(true);
        this.categoryPathStringCounter = new utils.KeyCounter(true);

        this.depth = parent ? parent.depth + 1 : 0;

        this.name = name;
        this.title = title;
        this.isCategoryGroup = !!isCategoryGroup;
        this.rows = [];
        this.retainRows = !!retainRows;

        this.childAggregators = {};

        this.childAggregateFunction = childAggregateFunction;
        this.sortChildAggregatorsFunction = sortChildAggregatorsFunction;
        this.sortTxFunction = sortTxFunction;

        this.isFinal = false;
    };

    var proto = (function () {
        //privates


        //publics
        return {
            add: function (tx) {
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
                this.noteCounter.add(tx.correctedValues.note);
                this.transactionReasonCounter.add(tx.correctedValues.transactionReason);
                this.accountCounter.add(tx.accountId);
                this.transactionDateCounter.add(tx.correctedValues.transactionDateParsed);
                this.categoryPathStringCounter.add(tx.correctedValues.categoryPathString);

                if (this.childAggregateFunction) {
                    var childAggregator = this.childAggregateFunction(this, tx);
                    if (childAggregator) {
                        childAggregator.add(tx);
                    }
                }
            },

            setChildrenVisible: function(isChildrenVisible) {
                this.isChildrenVisible = isChildrenVisible;
                this.refreshVisibility(true);
            },

            refreshVisibility: function(isRecursive) {
                this.isTopLevel = this.depth === 1;

                /*
                    EParent = nearest non-optional parent
                    IsVisible = Root || (EParent.IsVisible && EParent.IsChildrenVisible && !IsOptional)
                    HasChildren = ItemCount > 0
                    IsChildrenVisible = (user driven)

                    On Expand/Collapse: Set IsChildrenVisible, Update IsVisible for all children
                    On refresh: Copy IsChildrenVisible from last state
                */
                this.isOptional = this.count === 1 && !this.isCategoryGroup && !this.isTopLevel;
                this.effectiveParent = this.parent ?
                    (this.parent.isOptional ? this.parent.effectiveParent : this.parent) : this;
                this.isVisible = this.isTopLevel ||
                    (this.effectiveParent.isVisible && this.effectiveParent.isChildrenVisible && !this.isOptional);
                this.isChildrenVisible = this.isTopLevel || this.isOptional ||
                    (this.isChildrenVisible === undefined ?
                        !this.effectiveParent.isTopLevel && !utils.isEmpty(this.childAggregators) :
                        this.isChildrenVisible);

                //Short cut method for template
                this.effectiveParentForTx = this.isOptional ? this.effectiveParent : this;
                this.isTxVisible = this.effectiveParentForTx.isVisible && this.effectiveParentForTx.isChildrenVisible;

                if (isRecursive) {
                    //Child must be done after visibility for parent is setup
                    utils.forEach(this.childAggregators, function (agg) { agg.refreshVisibility(isRecursive); });
                }
            },

            finalize: function() {
                this.flagCounter.finalize();
                this.noteCounter.finalize();
                this.transactionReasonCounter.finalize();
                this.accountCounter.finalize();
                this.transactionDateCounter.finalize();
                this.categoryPathStringCounter.finalize();
                
                this.refreshVisibility();

                this.isFinal = true;

                //Child must be done after visibility for parent is setup
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
            },

            getByGroupId: function(groupId) {
                return allAggregators[groupId];
            },

            getAllTx: function () {
                var allTx = this.rows;
                utils.forEach(this.childAggregators, function (agg) { allTx = allTx.concat(agg.getAllTx()); });
                return allTx;
            }
        };
    })();


    proto.constructor = $this;
    
    $this.prototype = proto;

    return $this;
});