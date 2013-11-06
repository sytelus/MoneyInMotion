define("txNavigationView", ["lodash", "Transaction", "text!templates/txNavigatorPane.txt", "utils", "handlebars", "jqueryui"],
    function (_, Transaction, paneTemplateText, utils, Handlebars, $) {

    "use strict";
    /*jshint -W080 */   //Allow explicit initialization with undefined

    return {
        refresh: function (txs, selectYear, selectMonth) {
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
                    year: year,
                    months:
                        _.map(monthsSet.toArray().sort(utils.compareFunction(true)), function (monthString) {
                            var monthInt = parseInt(monthString, 10);
                            var monthName = utils.getMonthName(monthInt);
                            var urlHash = "#" + $.param({ action:"showmonth", year: year, month: monthString });
                            return { monthName: monthName, urlHash: urlHash, monthString: monthString };
                        })
                };
            });

            navData.sort(utils.compareFunction(true, function (yearMonths) { return yearMonths.year; }));

            //Find indices of selected items
            var selectYearIndex = _.findIndex(navData, function (yearMonths) { return yearMonths.year === selectYear; });
            var selectMonthIndex = undefined;
            selectYearIndex = selectYearIndex >= 0 ? selectYearIndex : (navData.length ? 0 : undefined);
            if (selectYearIndex >= 0) {
                selectMonthIndex = _.findIndex(navData[selectYearIndex].months, function (monthInfo) { return monthInfo.monthString === selectMonth; });
                selectMonthIndex = selectMonthIndex >= 0 ? selectMonthIndex : (navData[selectYearIndex].length ? 0 : undefined);
            }

            if (selectYearIndex >= 0 && selectMonthIndex >= 0) {
                navData[selectYearIndex].months[selectMonthIndex].isSelected = true;
            }

            var paneTemplate = Handlebars.compile(paneTemplateText);
            var paneHtml = paneTemplate(navData);

            var accordionExists = $("#txNavigation").hasClass("ui-accordion");
            $("#txNavigation").empty();
            $("#txNavigation").append(paneHtml);

            if (accordionExists) {
                $("#txNavigation").accordion("refresh");
            }
            else {
                $("#txNavigation").accordion(
                    selectYearIndex ? { active: selectYearIndex, collapsible: true } : { collapsible: true }); //.accordion("option", "animate", false);
            }
        }
    };
});