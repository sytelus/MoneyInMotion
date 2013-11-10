define("txNavigationView", ["lodash", "Transaction", "text!templates/txNavigatorPane.txt", "common/utils", "jqueryui"],
    function (_, Transaction, templateText, utils, $) {

    "use strict";
    /*jshint -W080 */   //Allow explicit initialization with undefined
    
    var compiledTemplate;   //cache compiled template

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

            var templateData = yearMonths.toArray(function (year, monthsSet) {
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

            templateData.sort(utils.compareFunction(true, function (yearMonths) { return yearMonths.year; }));

            //Find indices of selected items
            var selectYearIndex = _.findIndex(templateData, function (yearMonths) { return yearMonths.year === selectYear; });
            var selectMonthIndex = undefined;
            selectYearIndex = selectYearIndex >= 0 ? selectYearIndex : (templateData.length ? 0 : undefined);
            if (selectYearIndex >= 0) {
                selectMonthIndex = _.findIndex(templateData[selectYearIndex].months, function (monthInfo) { return monthInfo.monthString === selectMonth; });
                selectMonthIndex = selectMonthIndex >= 0 ? selectMonthIndex : (templateData[selectYearIndex].length ? 0 : undefined);
            }

            if (selectYearIndex >= 0 && selectMonthIndex >= 0) {
                templateData[selectYearIndex].months[selectMonthIndex].isSelected = true;
            }

            compiledTemplate = compiledTemplate || utils.compileTemplate(templateText);
            var templateHtml = utils.runTemplate(compiledTemplate, templateData);

            var accordionExists = $("#txNavigationControl").hasClass("ui-accordion");
            $("#txNavigationControl").html(templateHtml);

            if (accordionExists) {
                $("#txNavigationControl").accordion("refresh");
            }
            else {
                $("#txNavigationControl").accordion(
                    selectYearIndex ? {
                        active: selectYearIndex, collapsible: true, heightStyle: "fill"
                    } : { collapsible: true, heightStyle: "fill"}); //.accordion("option", "animate", false);
            }
        }
    };
});