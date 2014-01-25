define("TransactionSummary", ["common/utils", "knockout"], function (utils, ko) {
    "use strict";

    //static privates
    var TransactionSummary = function () {
        var self = this;
        self.tx = ko.observable();
        self.txs = ko.observable();
        self.aggregator = ko.observable();
        self.netAggregator = ko.observable();
        self.netIncomAmountTypeString = ko.computed(function () {
            if (self.netAggregator()) {
                return self.netAggregator().netIncomAmount > 0 ? "savings" : "deficit";
            }
        });

        self.isTxProviderAttributesVisible = ko.observable(false);
        
        self.tx.subscribe(function () { self.isTxProviderAttributesVisible(false); });
    };

    var TransactionSummaryPrototype = (function () {
        //privates


        //publics
        return {
            showTxProviderAttributes: function () { this.isTxProviderAttributesVisible(true); }
        };
    })();
    TransactionSummaryPrototype.constructor = TransactionSummary;
    TransactionSummary.prototype = TransactionSummaryPrototype;

    return TransactionSummary;
});