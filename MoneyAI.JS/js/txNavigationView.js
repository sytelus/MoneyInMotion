define("txNavigationView", ["lodash", "Transaction", "moment", "buckets", "text!templates/txNavigatorPane.html!strip", "utils", "handlebars", "jqueryui"],
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
                
                var months = years.get(year);
                if (!months) {
                    months = new buckets.Set();
                    yearMonths.set(year, months);
                }

                months.add(month);
            }

            var years = yearMonths.keys().sort(utils.compareFunction(true));

            $("#txNavigation").empty();
            var paneTemplate = Handlebars.compile(paneTemplateText);

            for (var yearIndex = 0; yearIndex < years.length; yearIndex++) {
                var paneData = {
                    year: years[yearIndex],
                    months: yearMonths.get(years[yearIndex]).toArray().sort(utils.compareFunction(true))
                };

                var paneHtml = paneTemplate(panData);

                $("#txNavigation").append(paneHtml);
            }


        }
    };
});