define("txNavigationView", ["lodash", "Transaction", "moment"], function (_, Transaction, moment) {
    "use strict";
    return {
        initialize: function () {
        },

        load: function (txs, txEdits) {
            var yearMonths = _.map(txs.items, function (tx) {
                var correctedTransactionDate = Transaction.prototype.correctedTransactionDate.call(tx);
                return { year: correctedTransactionDate.format("YYYY"), month: correctedTransactionDate.format("MM") }
            });


            .groupBy(yearMonths, "year").sortBy();

            var uniqueYearAllMonths = ;
            var navData = 
        }
    };
});