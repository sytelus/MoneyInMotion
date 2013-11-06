define("utils", ["lodash", "moment", "buckets", "jquery", "debug"], function (_, moment, buckets, $, debug) {
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
        }
    };
});