define("txNavigationView", ["lodash", "Transaction", "moment", "buckets", "text!templates/txNavigatorPane.txt", "utils", "handlebars", "jqueryui"],
    function (_, Transaction, moment, buckets, paneTemplateText, utils, Handlebars, $) {

    "use strict";
    return {
        initialize: function () {
        },

        load: function (txs, txEdits) {
            var yearMonths = new buckets.Dictionary();

            for(var i = 0; i < txs.items.length; i++) {
                var correctedTransactionDate = Transaction.prototype.correctedTransactionDate.call(txs.items[i]);
                var year = correctedTransactionDate.format("YYYY");
                var month = correctedTransactionDate.format("MM");
                
                var months = yearMonths.get(year);
                if (!months) {
                    months = new buckets.Set();
                    yearMonths.set(year, months);
                }

                months.add(month);
            }

            var navData = yearMonths.toArray(function (year, monthsSet) {
                return {
                    year: year, months:
                        _.map(monthsSet.toArray().sort(utils.compareFunction(true)), function(monthString) {
                            return moment({ month: parseInt(monthString, 10) }).format("MMMM");
                        })
                };
            });

            navData.sort(utils.compareFunction(true, function (yearMonths) { return yearMonths.year; }));

            var paneTemplate = Handlebars.compile(paneTemplateText);
            var paneHtml = paneTemplate(navData);

            $("#txNavigation").empty();
            $("#txNavigation").append(paneHtml);
            $("#txNavigation").accordion();

        }
    };
});