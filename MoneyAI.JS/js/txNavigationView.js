define("txNavigationView", ["lodash", "Transaction", "text!templates/txNavigatorPane.txt", "utils", "handlebars", "jqueryui"],
    function (_, Transaction, paneTemplateText, utils, Handlebars, $) {

    "use strict";
    return {
        initialize: function () {
        },

        refresh: function (txs, txEdits) {
            var yearMonths = new utils.Dictionary();

            for(var i = 0; i < txs.items.length; i++) {
                var year = Transaction.prototype.getTransactionYearString.call(txs.items[i]);
                var month = Transaction.prototype.getTransactionMonthString.call(txs.items[i]);
                
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

            var accordionExists = $('#txNavigation').hasClass('ui-accordion');
            $("#txNavigation").empty();
            $("#txNavigation").append(paneHtml);
            if (accordionExists) {
                $("#txNavigation").accordion("refresh");
            }
            else {
                $("#txNavigation").accordion(); //.accordion("option", "animate", false);
            }
        }
    };
});