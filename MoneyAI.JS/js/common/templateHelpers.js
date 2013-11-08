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
        "typeof": function (l, r) { return typeof l === r; }
    };

    var helpers = [
        function formatCurrency(utils) {
            utils.registerTemplateHelper("formatCurrency", function (value) {

                if (!utils || !utils.formateCurrency || !value) {
                    throw new Error("utils.formatCurrency is required, one numeric/string argument is required");
                }

                return utils.formateCurrency(value);
            });
        },

        function repeatString(utils) {
            utils.registerTemplateHelper("repeatString", function (str, count, countAdjustment) {
                if (count === undefined) {
                    throw new TypeError("count parameter for repeatString template helper should not be undefined");
                }
                return utils.templateHtmlString(utils.repeatString(str, count + (countAdjustment || 0)));
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