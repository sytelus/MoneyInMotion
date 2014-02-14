define("common/utils", ["lodash", "moment", "buckets", "jquery", "debug", "accounting", "handlebars", "common/templateHelpers",
    "common/keyCounter", "common/koExtentions",
    "cryptojs.md5", "cryptojs.base64", "uuidjs", "jquery.ba-bbq", "json3", "mousetrap"],
    function (_, moment, buckets, $, debug, accounting, handlebars, templateHelpers, keyCounter, koExtentions,
        CryptoJS, CryptoJSBase64, UUIDjs, jQueryBbq, json3, mousetrap) {

   "use strict";

   accounting.settings.currency.format = {
       pos: "%s %v",   // for positive values, eg. "$ 1.00" (required)
       neg: "%s (%v)", // for negative values, eg. "$ (1.00)" [optional]
       zero: "%s %v"  // for zero values, eg. "$  --" [optional]
   };

        //Fix textarea CR/LF issue - http://api.jquery.com/val/
   $.valHooks.textarea = {
       get: function( elem ) {
           return elem.value.replace( /\r?\n/g, "\r\n" );
       }
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

        log: function (textOrArray, statusBoxPriority, type) {
            type = type || "log";

            textOrArray = _.isArray(textOrArray) ? textOrArray : [textOrArray];

            (debug[type] || debug.log).apply(debug, textOrArray);

            if (statusBoxPriority !== undefined) {
                $(document).triggerHandler("statusBoxUpdate", [textOrArray, type, statusBoxPriority]);
            }
        },
        isInputElementInFocus: function () {
            return $(document.activeElement).is(":input");
        },
        cancelRestOfTheHandlers: function(event) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        },
        isElementInView: function(elem, partialViewOk) {
            var docViewTop = $(window).scrollTop(),
            docViewBottom = docViewTop + $(window).height(),
            elemTop = $(elem).offset().top,
            elemBottom = elemTop + $(elem).height(),
            isTopInView = elemTop >= docViewTop,
            isBottomInView = elemBottom <= docViewBottom;

            return (partialViewOk && (isBottomInView || isBottomInView)) || (isTopInView && isBottomInView);
        },

        Dictionary: buckets.Dictionary,
        Set: buckets.Set,
        isObject: _.isObject,
        isPlainObject: _.isPlainObject,
        isString: _.isString,
        isFunction: $.isFunction,
        
        stringify: function(value) {
            return json3.stringify(value);
        },

        isDeferredPromise: function (value) {
            //instanceof $.Deferred doesn't seem to work (also if it's promise)
            return !(value === undefined || !$.isFunction(value.done) || !$.isFunction(value.fail));
        },

        createDeferred: function() {
            return new $.Deferred();
        },

        boolToDeferredPromise: function (value) {
            //If not already a deferred object?
            if (!utilsInstance.isDeferredPromise(value)) {
                var deferred = utilsInstance.createDeferred();
                deferred = !!value ? deferred.resolve() : deferred.reject();
                return deferred.promise();
            }
            
            return value;
        },

        convertLineBreaksToHtml: function(text) {
            return (text || "").replace(/(\r\n|\n|\r)/gm, "<br/>");
        },

        htmlEncode: function (html) {
            return String(html)
                      .replace(/&/g, "&amp;")
                      .replace(/"/g, "&quot;")
                      .replace(/'/g, "&#39;")   //http://stackoverflow.com/questions/2083754/why-shouldnt-apos-be-used-to-escape-single-quotes
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;");
        },

        htmlDecode: function (html) {
            var a = document.createElement( "a" ); a.innerHTML = html;
            return a.textContent;
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
        now: function() {
            return new moment();
        },

        getEventCurrentTarget: function(event) {
            return (event.currentTarget) ? event.currentTarget : event.srcElement;  //IE8 compatibility
        },

        FormatStringDateLocalized: "L",
        formateDate: function(date, formatString) {
            return moment(date).format(formatString);
        },

        sum: function (collection, callback, thisArg) {
            if (callback) {
                collection = _.map(collection, callback, thisArg);
            }

            var sum = 0;
            _.forEach(collection, function (value) { sum += value; });

            return sum;
        },

        toObject: function (collection, getKey, getValue, thisArg) {
            var result = {};
            utilsInstance.forEach(collection, function (item, indexOrKey) {
                var key = !utilsInstance.isString(getKey) ? getKey.call(thisArg, item, indexOrKey) : item[getKey];
                var value = !utilsInstance.isString(getValue) ? getValue.call(thisArg, item, indexOrKey) : item[getValue];

                if (key !== undefined) {
                    result[key] = value;
                }
            }, thisArg);

            return result;
        },

        mostOccuring: function(collection, callback, thisArg) {
            if (callback) {
                collection = _.map(collection, callback, thisArg);
            }

            var keys = {};

            _.forEach(collection, function (value) {
                if (value !== undefined) {
                    var count = keys[value];
                    if (count === undefined) {
                        keys[value] = 1;
                    }
                    else {
                        keys[value] = count + 1;
                    }
                }
            });

            var maxKey, maxCount = Number.NEGATIVE_INFINITY;
            _.forOwn(keys, function (count, key) {
                if (count > maxCount) {
                    maxCount = count;
                    maxKey = key;
                }
            });

            return maxKey;
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
        escapeTemplateExpression: function (str) {
            return handlebars.Utils.escapeExpression(str);
        },
        templateHtmlString: function (str) {
            return new handlebars.SafeString(str);
        },

        addKeyBoardShortcut: function(keys, handler) {
            mousetrap.bind(keys, handler);
        },
        removeKeyBoardShortcut: function(keys) {
            mousetrap.unbind(keys);
        },
        removeAllKeyBoardShortcuts: function() {
            mousetrap.reset();
        },

        nextVisibleSibling: function (element, invisibleRowClassName) {
            var selector = invisibleRowClassName ? (":not(." + invisibleRowClassName + ")") : ".visible";
            var invisibleElements = element.nextUntil(selector);
            if (invisibleElements.length === 0) {
                return element.next();
            }
            else {
                return invisibleElements.last().next();
            }
        },
        prevVisibleSibling: function (element, invisibleRowClassName) {
            var selector = invisibleRowClassName ? (":not(." + invisibleRowClassName + ")") : ".visible";
            var invisibleElements = element.prevUntil(selector);
            if (invisibleElements.length === 0) {
                return element.prev();
            }
            else {
                return invisibleElements.last().prev();
            }
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

        trim: $.trim,
        parseInt: function(value) {
            return parseInt(value, 10);
        },
        parseFloat: function(value) {
            return parseFloat(value);
        },
        parseDate: function(value, format) {
            return moment(value, format);
        },
        fromNativeDate: function(value) {
            return moment(value);
        },
        toNativeDate: function(value) {
            return value.toDate();
        },
        getMD5Hash: function(valueString) {
            var hash = CryptoJS.MD5(valueString);
            return hash.toString(CryptoJS.enc.Base64);
        },
        createUUID: function () { return UUIDjs.create().toString(); },
        int32Max: 2147483647,

        forEach: _.forEach,
        toValueArray: _.values,
        size: _.size,
        forOwn: _.forOwn,
        filter: _.filter,
        map: _.map,
        isEmpty: _.isEmpty,
        distinct: _.uniq,
        findFirst: function (collection, callback, thisArg, mapFunctionForFound, defaultIfNotFound) {
            var found = _.find(collection, callback, thisArg);

            if (mapFunctionForFound && found !== undefined) {
                found = mapFunctionForFound.call(thisArg, mapFunctionForFound);
            }

            return found === undefined ? defaultIfNotFound : found;
        },
        max: _.max,
        min: _.min,
        any: _.any,
        all: _.all,
        clone: _.clone,
        extend: _.extend,
        bind: _.bind,
        applyDefaults: _.partialRight(_.assign, function (a, b) {
                return typeof a === "undefined" ? b : a;
        }),
        toKeyValueArray: function (obj) {
            return _.map(obj, function (value, key) { return { key: key, value: value }; });
        },
        keys: _.keys,
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
        triggerEvent: function (source, eventName, eventDataArray) {
            $(source || document).triggerHandler(eventName, eventDataArray);
        },

        //non-DOM related events
        subscribe: function (source, eventName, handler) {
            $(source || document).on(eventName, handler);
        },
        unsubscribe: function (source, eventName) {
            $(source || document).off(eventName);
        },

        addEventHandler: function(source, events, selector, handler) {
            $(source || document).on(events, selector, handler);
        },

        setUrlHash: function(url) {
            $.bbq.pushState(url);
        },

        dom: function(obj) {
            return $(obj || document);
        },
        splitWhiteSpace: function (s) {
            return (s || "").split(/\s+/g);
        },
        dom2obj: function (selector, obj, converter, thisArg) {
            var dom = $(selector),
                elements = dom.find("[data-set-prop]");

            $.each(elements, function(element) {
                var propertyName = element.attr("data-set-prop"),
                    tagName = element.prop("tagName"),
                    isConverterFunction = $.isFunction(converter),
                    isObjFunction = $.isFunction(obj);

                var elementValue;

                if (tagName === "INPUT") {
                    //Checkbox/radio returns "on" when there is no value attribute and if they are selected otherwise undefined. If value attribute
                    //is available then :checked returned undefined or that value.
                    var inputType = element.attr("type");
                    if (inputType === "checkbox" || inputType === "radio") {
                        elementValue = element.filter(":checked").val();
                        if (elementValue === undefined && inputType === "checkbox") {
                            elementValue = false;
                        }
                        else if (elementValue === "on") {
                            elementValue = true;
                        }
                    }
                }
                else {
                    elementValue = element.val();
                }
                
                if (elementValue === undefined) {
                    return; //Prevent unset radiobox to overwrite properties
                }
                if (converter) {
                    if (isConverterFunction) {
                        elementValue = converter.call(thisArg, elementValue, propertyName);
                    }
                    else {
                        var converterFunction = converter[propertyName];
                        if (converterFunction) {
                            elementValue = converterFunction.call(thisArg, elementValue, propertyName);
                        }
                    }
                }

                if (isObjFunction) {
                    obj.call(thisArg, elementValue, propertyName);
                }
                else {
                    obj[propertyName] = elementValue;
                }
            });
        },

        noop: function () { }
    };

    //Set up members with cyclic dependecy
    utilsInstance.KeyCounter = keyCounter(utilsInstance);

    templateHelpers.registerAll(utilsInstance);

    koExtentions.initialize(utilsInstance);

    return utilsInstance;

});