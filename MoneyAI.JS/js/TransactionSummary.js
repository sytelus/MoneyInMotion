define("TransactionSummary", ["common/utils", "knockout"], function (utils, ko) {
    "use strict";

    //static privates
    var TransactionSummary = function () {
        var self = this;
        self.selectedTx = ko.observable();
        self.selectedTxs = ko.observable();
        self.selectedAggregator = ko.observable();
        self.netAggregator = ko.observable();
        self.txs = ko.observable();
        self.netIncomeAmountTypeString = ko.computed(function () {
            if (self.netAggregator()) {
                return self.netAggregator().netIncomeAmount > 0 ? "savings" : "deficit";
            }
        });
        self.netIncomeAmountClassString = ko.computed(function () {
            if (self.netAggregator()) {
                return self.netAggregator().netIncomeAmount > 0 ? "positiveNetAmount" : "negativeNetAmount";
            }
        });
        self.netIncomeAmount = ko.computed(function () {
            if (self.netAggregator()) {
                return utils.formateCurrency(Math.abs(self.netAggregator().netIncomeAmount));
            }
        });

        self.isTxProviderAttributesVisible = ko.observable(false);
        
        self.selectedTx.subscribe(function () { self.isTxProviderAttributesVisible(false); });
    };

    var TransactionSummaryPrototype = (function () {
        //privates


        //publics
        return {
            showTxProviderAttributes: function () { this.isTxProviderAttributesVisible(true); },
            formateCurrency: utils.formateCurrency
        };
    })();
    TransactionSummaryPrototype.constructor = TransactionSummary;
    TransactionSummary.prototype = TransactionSummaryPrototype;

    return TransactionSummary;
});