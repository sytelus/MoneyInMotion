define("common/utils", ["lodash", "moment", "buckets", "jquery", "debug", "accounting", "handlebars", "common/templateHelpers", "common/keyCounter",
    "cryptojs.md5", "cryptojs.base64", "uuidjs", "json3"],
    function (_, moment, buckets, $, debug, accounting, handlebars, templateHelpers, keyCounter, CryptoJS, CryptoJSBase64, UUIDjs, json3) {

   "use strict";

   accounting.settings.currency.format = {
       pos: "%s %v",   // for positive values, eg. "$ 1.00" (required)
       neg: "%s (%v)", // for negative values, eg. "$ (1.00)" [optional]
       zero: "%s %v"  // for zero values, eg. "$  --" [optional]
   };

    var utilsInstance = {
        compareFunction: function(isReverse, mapFunction, thisArg) {
            return function (a, b) {

                var x = a, y = b;

                if ($.isFunction(mapFunction)) {
                    x = mapFunction.call(thisArg, a);
                    y = mapFunction.call(thisArg, b);
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
        isObject: _.isObject,

        stringify: function(value) {
            return json3.stringify(value);
        },

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
        },

        registerTemplateHelper: function (helperName, helperFunction) {
            handlebars.registerHelper(helperName, helperFunction);
        },

        registerTemplatePartial: function (partialName, partialTemplateCompiled) {
            handlebars.registerPartial(partialName, partialTemplateCompiled);
        },

        templateHtmlString: function (str) {
            return new handlebars.SafeString(str);
        },

        repeatString: function (pattern, count) {
            if (count < 1) {
                return "";
            }
            var result = "";
            while (count > 0) {
                if (count & 1) {
                    result += pattern;
                }
                count >>= 1;
                pattern += pattern;
            }
            return result;
        },

        getMD5Hash: function(valueString) {
            var hash = CryptoJS.MD5(valueString);
            return hash.toString(CryptoJS.enc.Base64);
        },
        createUUID: function () { return UUIDjs.create(); },

        forEach: _.forEach,
        toValueArray: _.values,
        isFunction: $.isFunction,
        size: _.size,
        forOwn: _.forOwn,
        filter: _.filter,
        map: _.map,
        isEmpty: _.isEmpty,
        max: _.max,
        clone: _.clone,
        extend: _.extend,
        applyDefaults: _.partialRight(_.assign, function (a, b) {
                return typeof a === "undefined" ? b : a;
        }),
        toKeyValueArray: function (obj) {
            return _.map(obj, function (value, key) { return { key: key, value: value }; });
        },
        compareStrings: function (string1, string2, ignoreCase, useLocale) {
            if (!!ignoreCase) {
                if (!!useLocale) {
                    string1 = string1.toLocaleLowerCase();
                    string2 = string2.toLocaleLowerCase();
                }
                else {
                    string1 = string1.toLowerCase();
                    string2 = string2.toLowerCase();
                }
            }

            return string1 === string2;
        },
        noop: function () { }
    };

    //Set up members with cyclic dependecy
    utilsInstance.KeyCounter = keyCounter(utilsInstance);

    templateHelpers.registerAll(utilsInstance);

    return utilsInstance;

});