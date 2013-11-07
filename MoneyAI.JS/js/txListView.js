define("txListView", ["lodash", "Transaction", "utils", "text!templates/txList.txt"],
    function (_, Transaction, utils, templateText) {

    "use strict";

    var compiledTemplate;   //cache compiled template

    return {
        refresh: function (txs, selectedYear, selectedMonth) {
            /* We'll construct data in following format and pass to handlebars for rendering
                AggregateSums is defined as {count, postiveSum, negativeSum, netSum, sumsByType:[{type, sum}]}
                RowData is Transaction object with property correctedValues populated

                {
                    body: [{
                        group: {title, aggregateSums: AggregateSums, running: AggregateSums},
                        rows: [rowData: RowData, ...]
                    }, ...]
                }
                
            */

            //first filter out the transactions
            var selectedTxs = _.filter(txs.items, function (tx) {
                return tx.correctedValues.transactionYearString === selectedYear && tx.correctedValues.transactionMonthString === selectedMonth;
            });

            _.forEach(selectedTxs, function (tx) { Transaction.prototype.ensureAllCorrectedValues.call(tx); });

            var templateData = {
                body: [{
                    rows: selectedTxs
                }]
            };

            compiledTemplate = compiledTemplate || utils.compileTemplate(templateText);
            var templateHtml = utils.runTemplate(compiledTemplate, templateData);

            $("#txList").html(templateHtml);
        }
    };
});