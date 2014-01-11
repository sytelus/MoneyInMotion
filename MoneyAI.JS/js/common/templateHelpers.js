define("common/templateHelpers", [], function () {
    "use strict";

    var operators = {
        //"==": function (l, r) { return l == r; },
        "===": function (l, r) { return l === r; },
        //"!=": function (l, r) { return l != r; },
        "!==": function (l, r) { return l !== r; },
        "<": function (l, r) { return l < r; },
        ">": function (l, r) { return l > r; },
        "<=": function (l, r) { return l <= r; },
        ">=": function (l, r) { return l >= r; },
        "typeof": function (l, r) { return typeof l === r; },
        "!typeof": function (l, r) { return typeof l !== r; }
    };

    var lastSequenceNumber = 0;

    var helpers = [
        function formatCurrency(utils) {
            utils.registerTemplateHelper("formatCurrency", function (value) {

                if (!utils || !utils.formateCurrency || value === undefined) {
                    throw new Error("utils.formatCurrency is required, one numeric/string argument is required");
                }

                return utils.formateCurrency(value);
            });
        },

        function sequenceNumber(utils) {
            utils.registerTemplateHelper("sequenceNumber", function (value) {
                if (!!value) {
                    return lastSequenceNumber;
                }
                else {
                    return ++lastSequenceNumber;
                }
            });
        },

        function not(utils) {
            utils.registerTemplateHelper("not", function (value) {
                return !!!value;
            });
        },

        function math(utils) {
            utils.registerTemplateHelper("math", function (functionName, param1, param2, param3) {
                return Math[functionName](param1, param2, param3);
            });
        },

        function breakline(utils) {
            utils.registerTemplateHelper("breakline", function (text) {
                text = utils.escapeTemplateExpression(text);
                text = utils.convertLineBreaksToHtml(text);
                return utils.templateHtmlString(text);
            });
        },

        function stringify(utils) {
            utils.registerTemplateHelper("stringify", function (value) {
                if (value === undefined) {
                    return "undefined";
                }
                else if (value === null) {
                    return "null";
                }
                else if (utils.isObject(value)) {
                    return utils.stringify(value);
                }
                else {
                    return value.toString();
                }
            });
        },

        function repeatString(utils) {
            utils.registerTemplateHelper("repeatString", function (str, count, countMultiplier, options) {
                if (countMultiplier === undefined) {
                    throw new TypeError("count parameter for repeatString template helper should not be undefined");
                }

                if (options === undefined) {
                    options = countMultiplier;
                    countMultiplier = undefined;
                }

                return utils.templateHtmlString(utils.repeatString(str, (count * (countMultiplier === undefined ? 1 : countMultiplier))));
            });
        },

        function truncateText(utils) {
            utils.registerTemplateHelper("truncateText", function (str, maxLength, options) {
                if (options === undefined) {
                    throw new TypeError("maxLength parameter for truncateText template helper should not be undefined");
                }

                str = str || "";
                var truncated = str.substring(0, maxLength);
                if (truncated !== str) {
                    str = utils.htmlEncode(truncated) + "&hellip;";
                }
                else {
                    str = truncated;
                }

                return utils.templateHtmlString(str);
            });
        },

        function compare(utils) {
            /* Usage:
                {{#compare Database.Tables.Count ">" 5}}
                There are more than 5 tables
                {{/compare}}

                {{#compare "Test" "Test"}}
                Default comparison of "==="
                {{/compare}}
            */
            utils.registerTemplateHelper("compare", function (lvalue, operator, rvalue, options) {
                if (arguments.length < 3) {
                    throw new Error("Handlerbars Helper 'compare' needs 2 parameters");
                }

                if (options === undefined) {
                    options = rvalue;
                    rvalue = operator;
                    operator = "===";
                }

                if (!operators[operator]) {
                    throw new Error("Handlerbars Helper 'compare' doesn't know the operator " + operator);
                }

                if (utils.isFunction(lvalue)) {
                    lvalue = lvalue.call(this);
                }
                if (utils.isFunction(rvalue)) {
                    rvalue = rvalue.call(this);
                }
                if (utils.isFunction(operator)) {
                    operator = operator.call(this);
                }

                var result = operators[operator](lvalue, rvalue);

                if (result) {
                    return options.fn(this);
                } else {
                    return options.inverse(this);
                }
            });
        }
    ];

    return {
        registerAll: function (utils) {
            utils.forEach(helpers, function (h) { h(utils); });
        }
    };
});