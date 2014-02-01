define("templateHelpers", ["transactionReasonUtils", "Transaction",
        "text!templates/txListTransactionRow.html", "text!templates/txListTransactionGroup.html", "text!templates/txEditRule.html"],
    function (transactionReasonUtils, Transaction, txListTransactionRowHtml, txListTransactionGroupHtml, txEditRuleHtml) {
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
            utils.registerTemplateHelper("notePreview", function (noteOrNoteKeys) {
                var totalLength, previewString;
                if (!noteOrNoteKeys || utils.isString(noteOrNoteKeys)) {
                    previewString = (noteOrNoteKeys || "").substring(0, 10);
                    totalLength = (noteOrNoteKeys || "").length;
                }
                else {
                    var fullPartialNotes = utils.map(utils.filter(utils.keys(noteOrNoteKeys), function (key) { return key; }),
                        function (key) {
                            return key.substring(0, 10) + (key.length > 10 ? ".." : "");
                        }).join(", ");
                    previewString = fullPartialNotes.substring(0, 15);
                    totalLength = fullPartialNotes.length;
                }

                if (previewString.length < totalLength) {
                    previewString += "..";
                }

                previewString = utils.splitWhiteSpace(previewString).join(" "); //Remove tabs, CR, LF

                return utils.htmlEncode(previewString);
            });
        },

        function (utils) {
            utils.registerTemplateHelper("noteFullView", function (noteOrNoteKeys) {
                var noteFullView;
                if (!noteOrNoteKeys || utils.isString(noteOrNoteKeys)) {
                    noteFullView = noteOrNoteKeys;
                }
                else {
                    noteFullView = utils.map(utils.filter(utils.keys(noteOrNoteKeys), function (key) { return key; }),
                        function (key) { return utils.htmlEncode(key.substring(0, 500)); }).join("\n\n");
                }

                if (noteFullView.length > 500) {
                    noteFullView = noteFullView.substring(0, 498) + "..";
                }

                noteFullView = utils.convertLineBreaksToHtml(noteFullView); //replace line breaks with <br>
                return noteFullView;
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
                return utils.map(transactionReasonUtils.transactionReasonTitleLookup, function (reasonTitle, reasonValue) {
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
            return utils.compileTemplate(txListTransactionRowHtml);
        },
        txGroup: function (utils) {
            return utils.compileTemplate(txListTransactionGroupHtml);
        },
        txEditRule: function (utils) {
            return utils.compileTemplate(txEditRuleHtml);
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