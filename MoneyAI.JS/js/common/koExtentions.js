define("common/koExtentions", ["knockout", "typeahead"], function (ko /*, typeahead */) {
    "use strict";

    return {
        initialize: function () {
            ko.bindingHandlers.typeahead = {
                init: function (element, valueAccessor, allBindingsAccessor /*, viewModel, bindingContext */) {
                    var $element = $(element);
                    var allBindings = allBindingsAccessor();
                    var typeaheadArr = ko.utils.unwrapObservable(valueAccessor());

                    var updateValues = function (val) {
                        allBindings.value(val);
                    };

                    $element.attr("autocomplete", "off")
                            .typeahead({
                                "local": typeaheadArr,
                                "minLength": allBindings.minLength,
                                "items": allBindings.items,
                            }).on("typeahead:selected", function (el, item) {
                                updateValues(item.value);
                            }).on("typeahead:autocompleted", function (el, item) {
                                updateValues(item.value);
                            });
                }
            };
        }
    };
});