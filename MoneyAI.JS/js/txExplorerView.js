define("TxExplorerView", ["TxListView", "TxNavigationView", "common/utils", "repository"], function (TxListView, TxNavigationView, utils, repository) {
    "use strict";

    var $this = function TxExplorerView(element) {
        var self = this;
        self.hostElement = element;

        var navigationElement = element.find(".txNavigationControl").first();
        self.txNavigationView = new TxNavigationView(navigationElement);

        utils.subscribe(self.txNavigationView, "afterRefresh", function (event, txs, txItems, txItemsKey) {
            self.txListView.refresh(txs, txItems, txItemsKey);
        });
        
        var listElement = element.find(".txListControl").first();
        self.txListView = new TxListView(listElement);
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