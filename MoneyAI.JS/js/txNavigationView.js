﻿define("txNavigationView", ["lodash", "Transaction", "text!templates/txNavigatorPane.txt", "common/utils"],
    function (_, Transaction, templateText, utils) {

    "use strict";
    /*jshint -W080 */   //Allow explicit initialization with undefined
    
    var compiledTemplate;   //cache compiled template

    return {
        refresh: function (txs, selectYearString, selectMonthString) {
            var yearMonths = new utils.Dictionary();

            for(var i = 0; i < txs.items.length; i++) {
                var yearString = Transaction.prototype.getTransactionYearString.call(txs.items[i]);
                var monthString = Transaction.prototype.getTransactionMonthString.call(txs.items[i]);
                
                var months = yearMonths.get(yearString);
                if (!months) {
                    months = new utils.Set();
                    yearMonths.set(yearString, months);
                }

                months.add(monthString);
            }

            var templateData = yearMonths.toArray(function (yearString, monthsSet) {
                return {
                    yearString: yearString,
                    months:
                        _.map(monthsSet.toArray().sort(utils.compareFunction(true)), function (monthString) {
                            var monthInt = parseInt(monthString, 10);
                            var monthName = utils.getMonthName(monthInt);
                            var urlHash = "#" + $.param({ action:"showmonth", yearString: yearString, monthString: monthString });
                            return { monthName: monthName, urlHash: urlHash, monthString: monthString };
                        })
                };
            });

            templateData.sort(utils.compareFunction(true, function (yearMonths) { return yearMonths.yearString; }));

            //Find indices of selected items
            var selectYearIndex = _.findIndex(templateData, function (yearMonths) { return yearMonths.yearString === selectYearString; });
            var selectMonthIndex = undefined;
            selectYearIndex = selectYearIndex >= 0 ? selectYearIndex : (templateData.length ? 0 : undefined);
            if (selectYearIndex >= 0) {
                selectMonthIndex = _.findIndex(templateData[selectYearIndex].months, function (monthInfo) { return monthInfo.monthString === selectMonthString; });
                selectMonthIndex = selectMonthIndex >= 0 ? selectMonthIndex : (templateData[selectYearIndex].months.length ? 0 : undefined);
            }

            var selectedYearMonth = {yearString: undefined, monthString: undefined};
            if (selectYearIndex >= 0) {
                selectedYearMonth.yearString = templateData[selectYearIndex].yearString;
                templateData[selectYearIndex].isSelected = true;

                if (selectMonthIndex >= 0) {
                    selectedYearMonth.monthString = templateData[selectYearIndex].months[selectMonthIndex].monthString;
                    templateData[selectYearIndex].months[selectMonthIndex].isSelected = true;
                }
            }

            compiledTemplate = compiledTemplate || utils.compileTemplate(templateText);
            var templateHtml = utils.runTemplate(compiledTemplate, templateData);

            $("#txNavigationControl").html(templateHtml);

            return selectedYearMonth;
        }
    };
});