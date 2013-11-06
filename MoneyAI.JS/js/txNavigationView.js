define("txNavigationView", ["lodash", "Transaction", "text!templates/txNavigatorPane.txt", "utils", "handlebars", "jqueryui"],
    function (_, Transaction, paneTemplateText, utils, Handlebars, $) {

    "use strict";
    return {
        initialize: function () {
        },

        load: function (txs, txEdits) {
            var yearMonths = new utils.Dictionary();

            for(var i = 0; i < txs.items.length; i++) {
                var correctedTransactionDate = Transaction.prototype.correctedTransactionDate.call(txs.items[i]);
                var year = utils.getYearString(correctedTransactionDate);
                var month = utils.getMonthString(correctedTransactionDate);
                
                var months = yearMonths.get(year);
                if (!months) {
                    months = new utils.Set();
                    yearMonths.set(year, months);
                }

                months.add(month);
            }

            var navData = yearMonths.toArray(function (year, monthsSet) {
                return {
                    year: year, months:
                        _.map(monthsSet.toArray().sort(utils.compareFunction(true)), function (monthString) {
                            var monthInt = parseInt(monthString, 10);
                            var monthName = utils.getMonthName(monthInt);
                            var urlHash = "#" + $.param({ action:"showmonth", year: year, month: monthString });
                            return { monthName: monthName, urlHash: urlHash };
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