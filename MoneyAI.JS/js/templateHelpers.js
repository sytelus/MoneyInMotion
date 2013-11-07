define("templateHelpers", [], function () {
    "use strict";

    var helpers = [
        function (utils) {
            utils.registerTemplateHelper("txEntityNameDisplay", function (tx) {
                //If name is not corrected use normalized version
                return tx.correctedValues.entityName == tx.entityName ? tx.entityNameNormalized : tx.correctedValues.entityName;
            });
        },

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

    return {
        registerAll: function (utils) {
            utils.forEach(helpers, function (h) { h(utils); });
        }
    };
});