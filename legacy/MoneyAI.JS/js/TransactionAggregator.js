define("TransactionAggregator", ["common/utils"], function (utils) {
    "use strict";

    //static privates

    //Store previous aggregators so we can lookup previous state of isChildrenVisible property
    var allAggregators = {},
        defaultSortSubAggregatorsFunction = function (aggs) {
            aggs.sort(utils.compareFunction(false, function (agg) { return agg.sum; }));
            return aggs;
        },
        defaultSubAggregateChildTxFunction = function (parentAggregator, childTx, parentTx) {
            var childAggregatorName = childTx.children ? "ctx_" + childTx.id : "_childTxAggregator",
                childAggregator = parentAggregator.subAggregators[childAggregatorName];

            if (!childAggregator) {
                childAggregator = new TransactionAggregator(parentAggregator, childAggregatorName, {
                    title: parentTx.correctedValues.entityNameBest, isLineItems: true   //, isOptionalGroup: false
                });
                parentAggregator.subAggregators[childAggregatorName] = childAggregator;
            }

            return childAggregator;
        },
        addChildTx = function (childTx, parentTx, currentAggregator) {
            var subAggregatorChildTx = currentAggregator.options.subAggregateChildTxFunction(currentAggregator, childTx, parentTx);
            if (subAggregatorChildTx) {
                subAggregatorChildTx.add(childTx);
            }
            else {
                //This is the leaf aggregator
                currentAggregator.rows.push(childTx);
            }
        },
        optionsDefault = {
            sortTxFunction: function (txRows) {
                txRows.sort(utils.compareFunction(false, function (tx) { return tx.amount; }));
                return txRows;
            },

            subAggregateMainTxFunction: undefined,
            subAggregateChildTxFunction: defaultSubAggregateChildTxFunction,
            sortSubAggregatorsFunction: defaultSortSubAggregatorsFunction,

            isCategoryGroup: false,
            retainChildrenVisibilityState: true,
            title: undefined,
            groupHeaderVisible: true,
            enableEdits: true,
            enableIndicators: true,
            enableExpandCollapse: true,
            isLineItems: false,
            isOptionalGroup: undefined  //auto decide
        };

    var TransactionAggregator = function (parent, name, options) {
        this.options = utils.extend({}, optionsDefault, {title: name}, options);
        
        //Disable saving state if name is not provided
        if (this.options.retainChildrenVisibilityState) {
            this.groupId = (parent ? parent.groupId : "") + "." + name;

            var previousValue = allAggregators[this.groupId];
            this.isChildrenVisible = previousValue ? previousValue.isChildrenVisible : undefined;
            allAggregators[this.groupId] = this;
        }

        this.parent = parent;

        this.count = 0;
        this.positiveSum = 0;
        this.negativeSum = 0;
        this.sum = 0;
        this.markedSum = 0;

        this.tag = {};

        this.flagCounter = new utils.KeyCounter(true, utils.KeyCounter.booleanKeyMap);
        this.noteCounter = new utils.KeyCounter(true);
        this.transactionReasonCounter = new utils.KeyCounter(true);
        this.accountCounter = new utils.KeyCounter(true);
        this.transactionDateCounter = new utils.KeyCounter(true);
        this.categoryPathStringCounter = new utils.KeyCounter(true);
        this.markedTxCount = 0;

        this.depth = parent ? parent.depth + 1 : 0;

        this.name = name;
        this.rows = [];

        this.subAggregators = {};

        this.isFinal = false;
    };

    var proto = (function () {
        //privates


        //publics
        return {
            add: function (tx, parents) {
                if (tx.correctedValues.amount > 0) {
                    this.positiveSum += Math.abs(tx.correctedValues.amount);
                }
                else {
                    this.negativeSum += Math.abs(tx.correctedValues.amount);
                }

                this.sum += tx.correctedValues.amount;
                this.count += 1;
                if (tx.tag.isMarked) {
                    this.markedTxCount += 1;
                    this.markedSum += tx.correctedValues.amount;
                }

                this.flagCounter.add(tx.correctedValues.isFlagged);
                this.noteCounter.add(tx.correctedValues.note);
                this.transactionReasonCounter.add(tx.correctedValues.transactionReason);
                this.accountCounter.add(tx.accountId);
                this.transactionDateCounter.add(tx.correctedValues.transactionDateParsed);
                this.categoryPathStringCounter.add(tx.correctedValues.categoryPathString);

                var subAggregatorMainTx;  //leave it undefined
                if (this.options.subAggregateMainTxFunction) {
                    subAggregatorMainTx = this.options.subAggregateMainTxFunction(this, tx, parents);
                }

                if (subAggregatorMainTx) {
                    subAggregatorMainTx.add(tx, parents);
                }
                else {  //Only go to child TX if we have ran out of aggregators for the main TX
                    if (tx.children && this.options.subAggregateChildTxFunction) {
                        utils.forEach(tx.children, function (childTxKvp) {
                            addChildTx(childTxKvp.Value, tx, this);
                        }, this);
                    }
                    else {
                        //This is the leaf aggregator
                        this.rows.push(tx);
                    }
                }
            },

            setChildrenVisible: function(isChildrenVisible) {
                this.isChildrenVisible = isChildrenVisible;
                this.refreshVisibility(true);
            },

            refreshVisibility: function(isRecursive) {
                this.isTopLevel = this.depth <= 1;

                /*
                    EParent = nearest non-optional parent
                    IsVisible = Root || (EParent.IsVisible && EParent.IsChildrenVisible && !IsOptional)
                    HasChildren = ItemCount > 0
                    IsChildrenVisible = (user driven)

                    On Expand/Collapse: Set IsChildrenVisible, Update IsVisible for all children
                    On refresh: Copy IsChildrenVisible from last state
                */
                this.hasSubAggregators = !utils.isEmpty(this.subAggregators);
                this.isOptional = this.options.isOptionalGroup !== undefined ? !!this.options.isOptionalGroup :
                    (this.rows.length === 1 && this.options.title === this.rows[0].correctedValues.entityNameBest &&
                        !this.options.isCategoryGroup && !this.isTopLevel);
                this.effectiveParent = this.parent ?
                    (this.parent.isOptional ? this.parent.effectiveParent : this.parent) : this;
                this.isVisible = this.isTopLevel ||
                    (this.effectiveParent.isVisible && this.effectiveParent.isChildrenVisible && !this.isOptional);
                this.isChildrenVisible = this.isTopLevel || this.isOptional ||
                    (this.isChildrenVisible === undefined ?
                        !this.effectiveParent.isTopLevel && !utils.isEmpty(this.subAggregators) :
                        this.isChildrenVisible);

                //Short cut method for template
                this.effectiveParentForTx = this.isOptional ? this.effectiveParent : this;
                this.isTxVisible = this.effectiveParentForTx.isVisible && this.effectiveParentForTx.isChildrenVisible;
                this.txIndentLevel = this.effectiveParentForTx.isTopLevel ? 0 : this.effectiveParentForTx.depth;
                this.groupIndentLevel = this.effectiveParent.isTopLevel ? 0 : this.effectiveParent.depth;

                if (isRecursive) {
                    //Child must be done after visibility for parent is setup
                    utils.forEach(this.subAggregators, function (agg) { agg.refreshVisibility(isRecursive); });
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
                utils.forEach(this.subAggregators, function (agg) { agg.finalize(); });
            },

            toSubAggregatorsArray: function () {
                var subAggregatorsArray = utils.toValueArray(this.subAggregators);
                if (this.options.sortSubAggregatorsFunction) {
                    subAggregatorsArray = this.options.sortSubAggregatorsFunction(subAggregatorsArray);
                }
                return subAggregatorsArray;
            },

            toTxArray: function () {
                if (this.options.sortTxFunction) {
                    this.rows = this.options.sortTxFunction(this.rows);
                }
                return this.rows;
            },

            getByGroupId: function(groupId) {
                return allAggregators[groupId];
            },

            getAllTx: function () {
                var allTx = this.rows;
                utils.forEach(this.subAggregators, function (agg) { allTx = allTx.concat(agg.getAllTx()); });
                return allTx;
            }
        };
    })();


    proto.constructor = TransactionAggregator;
    
    TransactionAggregator.prototype = proto;

    return TransactionAggregator;
});