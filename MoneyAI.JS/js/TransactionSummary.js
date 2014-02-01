define("TransactionSummary", ["common/utils", "knockout", "common/popoverForm", "jquery",
    "text!templates/markTransactions.html"],
    function (utils, ko, popoverForm, $, markTransactionsHtml) {
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
            formateCurrency: utils.formateCurrency,
            showMarkTransactionsDialog: function (data, event) {
                var self = this,
                    element = $(utils.getEventCurrentTarget(event));

                self.markTxViewModel = self.markTxViewModel || {
                    startDate: utils.now().subtract("days", 7).format("YYYY-MM-DD"),
                    endDate: utils.now().format("YYYY-MM-DD")
                };
                
                element.popoverForm(markTransactionsHtml, self.markTxViewModel, {
                    titleIconClass: "",
                    titleHtml:"Mark Transactions",
                    afterDestroy: function (isOkOrCancel, viewModel) {
                        if (isOkOrCancel) {
                            endDate: utils.now().format("YYYY-MM-DD")
                            utils.triggerEvent(self, "markTx", [
                                utils.parseDate(viewModel.startDate, "YYYY-MM-DD"),
                                utils.parseDate(viewModel.endDate, "YYYY-MM-DD")]);
                        }
                    }
                });
            }
        };
    })();
    TransactionSummaryPrototype.constructor = TransactionSummary;
    TransactionSummary.prototype = TransactionSummaryPrototype;

    return TransactionSummary;
});