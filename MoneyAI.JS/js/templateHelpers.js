define("templateHelpers", ["text!templates/txListTransactionRow.txt", "text!templates/txListTransactionGroup.txt"],
    function (txListTransactionRowText, txListTransactionGroupText) {
    "use strict";

    var helpers = [
        function (utils) {
            utils.registerTemplateHelper("txCategoryPathDisplay", function (tx) {
                return (tx.correctedValues.categoryPath || []).join(" > ");
            });
        },

        function (utils) {
            utils.registerTemplateHelper("txTransactionDateDisplay", function (tx) {
                return utils.formateDate(tx.correctedValues.transactionDateParsed, utils.FormatStringDateLocalized);
            });
        }
    ];

    var partials = {
        tx: function (utils) {
            return utils.compileTemplate(txListTransactionRowText);
        },
        txGroup: function (utils) {
            return utils.compileTemplate(txListTransactionGroupText);
        }
    };

    return {
        registerAll: function (utils) {
            utils.forEach(helpers, function (h) { h(utils); });

            utils.forEach(partials, function (getPartialCompiled, partialName) {
                utils.registerTemplatePartial(partialName, getPartialCompiled(utils));
            });
        }
    };
});