define("templateHelpers", ["text!templates/txListTransactionRow.txt", "text!templates/txListTransactionGroup.txt", "text!templates/txEditRule.txt", "Transaction"],
    function (txListTransactionRowText, txListTransactionGroupText, txEditRuleText, Transaction) {
    "use strict";

    var helpers = [
        function (utils) {
            utils.registerTemplateHelper("txCategoryPathDisplay", function (tx) {
                return tx.correctedValues.categoryPathString;
            });
        },

        function (utils) {
            utils.registerTemplateHelper("txTransactionDateDisplay", function (transactionDateParsed) {
                return utils.formateDate(transactionDateParsed, utils.FormatStringDateLocalized);
            });
        },

        function (utils) {
            utils.registerTemplateHelper("txTransactionReasonDisplay", function (transactionReason) {
                return Transaction.prototype.getTransactionReasonTitle(transactionReason);
            });
        },

        function (utils) {
            utils.registerTemplateHelper("txTransactionReasonCounterDisplay", function (transactionReasonCounter) {
                var sortedReasons = utils.map(transactionReasonCounter.getSorted(true),
                    function (kvp) {
                        return kvp.value + " " +
                            Transaction.prototype.getTransactionReasonTitle(kvp.key, kvp.value);
                    }).join(", ");
                return sortedReasons;
            });
        },

        function (utils) {
            utils.registerTemplateHelper("amountFilterRange", function (isMin, amount) {
                var absAmount = Math.abs(amount);
                absAmount = Math.round(absAmount * (isMin ? 0.9 : 1.1));
                return absAmount;
            });
        },

        function (utils) {
            utils.registerTemplateHelper("txTransactionReasonSelectOptionsHtml", function (tx) {
                return utils.map(Transaction.prototype.transactionReasonTitleLookup, function (reasonTitle, reasonValue) {
                    return "<option value=\"" + reasonValue + "\" " +
                        (tx.correctedValues.transactionReason.toString() === reasonValue ? " selected " : "") + " >" + reasonTitle +
                        (tx.transactionReason.toString() === reasonValue ? " (keep original)" : "") +
                        "</option>";
                }).join("\n");
            });
        }
    ];

    var partials = {
        tx: function (utils) {
            return utils.compileTemplate(txListTransactionRowText);
        },
        txGroup: function (utils) {
            return utils.compileTemplate(txListTransactionGroupText);
        },
        txEditRule: function (utils) {
            return utils.compileTemplate(txEditRuleText);
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