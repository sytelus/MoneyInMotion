define("TxExplorerView", ["TxListView", "TxNavigationView", "common/utils", "repository", "knockout", "TransactionSummary"],
    function (TxListView, TxNavigationView, utils, repository, ko, TransactionSummary) {
    "use strict";

    var $this = function TxExplorerView(element) {
        var self = this;
        self.hostElement = element;

        var navigationElement = element.find(".txNavigationControl").first();
        self.txNavigationView = new TxNavigationView(navigationElement);

        var listElement = element.find(".txListControl").first();
        self.txListView = new TxListView(listElement, { enableKeyboardShortcuts: true });

        var txSummaryElement = element.find(".txSummaryControl").first();
        self.txSummaryViewModel = new TransactionSummary();
        ko.applyBindings(self.txSummaryViewModel, txSummaryElement[0]);
        txSummaryElement.removeClass("invisible");

        utils.subscribe(self.txNavigationView, "afterRefresh", function (event, txs, txItems, txItemsKey) {
            self.txListView.refresh(txs, txItems, txItemsKey);
        });

        utils.subscribe(self.txListView, "selectionChanged", function (event, selectionParameters) {
            self.txSummaryViewModel.selectedTx(selectionParameters.selectedTx);
            self.txSummaryViewModel.selectedTxs(selectionParameters.selectedTxs);
            self.txSummaryViewModel.selectedAggregator(selectionParameters.selectedAggregator);
            self.txSummaryViewModel.netAggregator(selectionParameters.netAggregator);
            self.txSummaryViewModel.txs(selectionParameters.txs);
        });

        utils.subscribe(self.txSummaryViewModel, "markTx", function (event, startDate, endDate) {
            utils.forEach(self.txs.getAllParentChildTransactions(), function(tx) {
                var transactionDate = utils.fromNativeDate(tx.correctedValues.transactionDate);
                tx.tag.isMarked = startDate <= transactionDate && endDate > transactionDate;
            });

            self.refresh(true);
        });
    };
    
    //public interface
    var proto = {
        refresh: function (uxOnlyRefresh) {
            var self = this;
            repository.getTransactions(!!!uxOnlyRefresh).done(function (txs) {
                self.txs = txs;
                self.txNavigationView.load(txs);
                self.txNavigationView.refresh();
            });
        }
    };

    proto.constructor = $this;
    $this.prototype = proto;

    return $this;
});