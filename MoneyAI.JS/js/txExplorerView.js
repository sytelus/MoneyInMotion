define("TxExplorerView", ["TxListView", "TxNavigationView", "common/utils", "repository", "knockout", "TransactionSummary"],
    function (TxListView, TxNavigationView, utils, repository, ko, TransactionSummary) {
    "use strict";

    var txSummaryViewModel;

    var transactionSelectedHandler = function (event, tx, row, netAggregator) {
        txSummaryViewModel.tx(tx);
        txSummaryViewModel.txs(null);
        txSummaryViewModel.aggregator(null);
        txSummaryViewModel.netAggregator(netAggregator);
    },
     transactionAggregateSelectedHandler = function (event, aggregate, row, txs, netAggregator) {
         txSummaryViewModel.tx(null);
         txSummaryViewModel.txs(txs);
         txSummaryViewModel.aggregator(aggregate);
         txSummaryViewModel.netAggregator(netAggregator);
     };

    var $this = function TxExplorerView(element) {
        var self = this;
        self.hostElement = element;

        var navigationElement = element.find(".txNavigationControl").first();
        self.txNavigationView = new TxNavigationView(navigationElement);

        var listElement = element.find(".txListControl").first();
        self.txListView = new TxListView(listElement, { enableKeyboardShortcuts: true });

        var txSummaryElement = element.find(".txSummaryControl").first();
        txSummaryViewModel = new TransactionSummary();
        ko.applyBindings(txSummaryViewModel, txSummaryElement[0]);
        txSummaryElement.removeClass("invisible");

        utils.subscribe(self.txNavigationView, "afterRefresh", function (event, txs, txItems, txItemsKey) {
            self.txListView.refresh(txs, txItems, txItemsKey);
        });

        utils.subscribe(self.txListView, "transactionRowSelected", transactionSelectedHandler);
        utils.subscribe(self.txListView, "transactionAggregateSelected", transactionAggregateSelectedHandler);
    };
    
    //public interface
    var proto = {
        refresh: function (uxOnlyRefresh) {
            var self = this;
            repository.getTransactions(!!!uxOnlyRefresh).done(function (txs) {
                self.txNavigationView.load(txs);
                self.txNavigationView.refresh();
            });
        }
    };

    proto.constructor = $this;
    $this.prototype = proto;

    return $this;
});