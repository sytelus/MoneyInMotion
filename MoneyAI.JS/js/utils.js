define("utils", ["lodash", "moment", "buckets", "jquery", "debug", "accounting", "handlebars"], function (_, moment, buckets, $, debug, accounting, handlebars) {
    "use strict";



    return {
        compareFunction: function(isReverse, mapFunction, thisArg) {
            var that = thisArg || this;
            return function (a, b) {

                var x = a, y = b;

                if ($.isFunction(mapFunction)) {
                    x = that.mapFunction(a);
                    y = that.mapFunction(b);
                }

                if (x < y) {
                    return isReverse ? 1 : -1;
                }
                if (x === y) {
                    return 0;
                }
                return isReverse ? -1 : 1;
            };
        },
        logger: debug,
        Dictionary: buckets.Dictionary,
        Set: buckets.Set,
        getMonthName: function (monthNumber) {
            return moment({ month: monthNumber }).format("MMMM");
        },
        getYearString: function(date) {
            return moment(date).format("YYYY");
        },
        getMonthString: function(date) {
            return moment(date).format("MM");
        },

        FormatStringDateLocalized: "L",
        formateDate: function(date, formatString) {
            return moment(date).format(formatString);
        },

        formateCurrency: function (number) {
            return accounting.formatMoney(number);
        },

        compileTemplate: function (templateText) {
            return handlebars.compile(templateText);
        },

        runTemplate: function (compiledTemplate, templateData) {
            return compiledTemplate(templateData);
        }

    };
});