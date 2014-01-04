define("TxNavigationView", ["lodash", "Transaction", "text!templates/txNavigatorPane.html", "common/utils"],
    function (_, Transaction, txNavigatorPaneHtml, utils) {

    "use strict";

    var compiledTemplate;   //cache compiled template
    var instanceId = 0;
    
    var hashChangeHandler = function (params) {
        var self = this;

        params = utils.isEmpty(params) ? { action: "showmonth" } : params;
        switch (params.action) {
            case "showmonth":
                self.refresh({ year: params.year, month: params.month });
                break;
            default:
                utils.log(["Unsupported hashchange was routed to txExplorerView", params], 5, "error");
                self.refresh({ year: params.year, month: params.month });
                break;
        }
    };

    var $this = function TxNavigationView(element) {
        var self = this;

        self.lastSelectedYearMonth = undefined;
        self.txs = undefined;
        self.hostElement = element;
        self.templateData = undefined;
        self.instanceId = ++instanceId;

        //event handler for hash change for jslink anchors
        $(window).on("hashchange", function (e) {
            var target = e.getState("target") || "main";

            if (target === "txx" || target === "main") {
                var params = $.deparam(e.fragment);
                if (params.iid === self.instanceId.toString()) {
                    hashChangeHandler.call(self, params);
                }
            }
            //else ignore unknown state
        });
    };

    var proto = {
        load: function (txs) {
            var self = this;
            var yearMonths = new utils.Dictionary();

            for (var i = 0; i < txs.items.length; i++) {
                var yearString = Transaction.prototype.getTransactionYearString.call(txs.items[i]);
                var monthString = Transaction.prototype.getTransactionMonthString.call(txs.items[i]);

                var months = yearMonths.get(yearString);
                if (!months) {
                    months = new utils.Set();
                    yearMonths.set(yearString, months);
                }

                months.add(monthString);
            }

            self.templateData = {};
            self.templateData.yearMonths = yearMonths.toArray(function (yearString, monthsSet) {
                    var yearMonthsArray = {
                        yearString: yearString,
                        months:
                            _.map(monthsSet.toArray().sort(utils.compareFunction(true)), function (monthString) {
                                var monthInt = utils.parseInt(monthString) - 1;
                                var monthName = utils.getMonthName(monthInt);
                                var urlHash = "#" + $.param({ target: "txx", action: "showmonth", year: yearString, month: monthString, iid: self.instanceId });
                                return { monthName: monthName, urlHash: urlHash, monthString: monthString };
                            })
                    };

                    //Pad month names to be equal length
                    if (yearMonthsArray.months.length > 0) {
                        var monthLongestLength = utils.max(yearMonthsArray.months, function (m) { return m.monthName.length; }).monthName.length;
                        for (var i = 0; i < yearMonthsArray.months.length; i++) {
                            yearMonthsArray.months[i].monthName += utils.repeatString(" ", monthLongestLength - yearMonthsArray.months[i].length);
                        }
                    }

                    return yearMonthsArray;
            });
            self.templateData.yearMonths.sort(utils.compareFunction(true, function (yearMonths) { return yearMonths.yearString; }));
            self.templateData.iid = self.instanceId;

            self.txs = txs;
        },

        refresh: function (filterParams) {
            var self = this;
            var selectYearString = filterParams && filterParams.year, selectMonthString = filterParams && filterParams.month;

            selectYearString = selectYearString || (self.lastSelectedYearMonth ? self.lastSelectedYearMonth.yearString : undefined);
            selectMonthString = selectMonthString || (self.lastSelectedYearMonth ? self.lastSelectedYearMonth.monthString : undefined);

            //Find indices of selected items
            var selectYearIndex = _.findIndex(self.templateData.yearMonths, function (yearMonths) { return yearMonths.yearString === selectYearString; });
            var selectMonthIndex;   //leave it undefined
            selectYearIndex = selectYearIndex >= 0 ? selectYearIndex : (self.templateData.yearMonths.length ? 0 : undefined);
            if (selectYearIndex >= 0) {
                selectMonthIndex = _.findIndex(self.templateData.yearMonths[selectYearIndex].months, function (monthInfo) { return monthInfo.monthString === selectMonthString; });
                selectMonthIndex = selectMonthIndex >= 0 ? selectMonthIndex : (self.templateData.yearMonths[selectYearIndex].months.length ? 0 : undefined);
            }

            self.lastSelectedYearMonth = { yearString: undefined, monthString: undefined };
            if (selectYearIndex >= 0) {
                self.lastSelectedYearMonth.yearString = self.templateData.yearMonths[selectYearIndex].yearString;
                self.templateData.yearMonths[selectYearIndex].isSelected = true;

                if (selectMonthIndex >= 0) {
                    self.lastSelectedYearMonth.monthString = self.templateData.yearMonths[selectYearIndex].months[selectMonthIndex].monthString;
                    self.templateData.yearMonths[selectYearIndex].months[selectMonthIndex].isSelected = true;
                }
            }

            compiledTemplate = compiledTemplate || utils.compileTemplate(txNavigatorPaneHtml);
            var templateHtml = utils.runTemplate(compiledTemplate, self.templateData);

            self.hostElement.html(templateHtml);

            //first filter out the transactions
            var selectedTxs = utils.filter(self.txs.items, function (tx) {
                return tx.correctedValues.transactionYearString === self.lastSelectedYearMonth.yearString &&
                    tx.correctedValues.transactionMonthString === self.lastSelectedYearMonth.monthString;
            });

            utils.triggerEvent(self, "afterRefresh", [self.txs, selectedTxs,
                self.instanceId + "." + self.lastSelectedYearMonth.yearString + "." + self.lastSelectedYearMonth.monthString,   //Current view key
                self.lastSelectedYearMonth]);

            return selectedTxs;
        }
    };

    proto.constructor = $this;
    $this.prototype = proto;

    return $this;

});