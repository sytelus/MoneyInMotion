define("txNavigationView", ["lodash", "Transaction", "moment", "buckets", "jstree", "utils"], function (_, Transaction, moment, buckets, jstree, utils) {
    "use strict";
    return {
        initialize: function () {
        },

        load: function (txs, txEdits) {
            var years = new buckets.Dictionary();

            for(var i = 0; i < txs.items.length; i++) {
                var correctedTransactionDate = Transaction.prototype.correctedTransactionDate.call(txs.items[i]);
                var year = correctedTransactionDate.format("YYYY");
                var month = correctedTransactionDate.format("MM");
                
                var months = years.get(year);
                if (!months) {
                    months = new buckets.Set();
                    years.set(year, months);
                }

                months.add(month);
            }

            var navData = [];
            years.forEach(function (year, months) {
                navData.push({ title: year, children: _.map(months.toArray().sort(utils.compareFunction(true)), function (m) { return { title: m } }) });
            });

            navData.sort(utils.compareFunction(true, function(d) { return d.title; }));

            $("#txNavigation").jstree({
                "json": {
                    "data": navData
                },
                "plugins": ["json"]
            });
        }
    };
});