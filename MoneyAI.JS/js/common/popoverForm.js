(function (factory) {
    "use strict";

    if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define(["jquery", "knockout", "bootstrap"], factory);
    } else {
        // Browser globals
        /* global ko: true */ //'ko' is not defined
        factory(jQuery, ko);
        /* global ko: false */
    }
}(function ($, ko) {
    "use strict";

    var destroyPopover = function (popoverElement) {
        popoverElement.popover("destroy");
    };

    $.fn.popoverForm = function (formHtml, viewModel, options) {
        var opts = $.extend({}, $.fn.popoverForm.defaults, options);

        return this.each(function () {
            var popoverElement = $(this);

            popoverElement
            .popover({
                animation: opts.animation,
                html: true,
                trigger: "manual",
                title: opts.titleHtml,
                content: opts.formHtmlPrefix + formHtml + opts.formHtmlSuffix + opts.footerHtml,
                placement: opts.placement
            })
            .popover("show");

            var popoverContainer = popoverElement.next(),
                onOkWrapper = function (data, event) {
                    if (!opts.onOk.call(viewModel, viewModel, opts, event, popoverElement, popoverContainer)) {
                        destroyPopover(popoverElement);
                        opts.afterClose.call(viewModel, true, viewModel, opts, event, popoverElement);
                    }
                },
                onCancelWrapper = function (data, event) {
                    if (!opts.onCancel.call(viewModel, viewModel, opts, event, popoverElement, popoverContainer)) {
                        destroyPopover(popoverElement);
                        opts.afterClose.call(viewModel, false, viewModel, opts, event, popoverElement);
                    }
                };

            opts.enableTitle = opts.enableTitle === undefined ?
                ko.computed(function () {
                    return ($.isFunction(opts.titleIconClass) ? opts.titleIconClass() : opts.titleIconClass) ||
                        ($.isFunction(opts.titleText) ? opts.titleText() : opts.titleText);
                }) :
                opts.enableTitle;

            ko.applyBindings({
                viewModel: viewModel,
                options: opts,
                onOkWrapper: onOkWrapper,
                onCancelWrapper: onCancelWrapper
            }, popoverContainer[0]);

            //Make sure popovers gets killed when hidden
            popoverElement.one("hidden.bs.popover", function () {
                popoverElement.popover("destroy");
            });
        });
    };

    /*jshint unused: vars */
    var defaultOkCancelHandler = function (viewModel, options, event, popoverElement, popoverContainer) { return false; },
        defaultAfterCloseHandler = function (isOkOrCancel, viewModel, options, event, popoverElement) { return false; };
    /*jshint unused: true */


    $.fn.popoverForm.defaults = {
        onOk: defaultOkCancelHandler,
        onCancel: defaultOkCancelHandler,
        afterClose: defaultAfterCloseHandler,
        cancelButtonText: ko.observable("Cancel"),
        okButtonText: ko.observable("OK"),
        okButtonEnabled: ko.observable(true),
        titleIconClass: ko.observable(""),
        titleText: ko.observable(""),
        placement: "bottom",
        closeOnEscKey: true,
        animation: false,
        /* jshint -W110 */ //Mixed double and single quotes.
        formHtmlPrefix: '\n<div data-bind="with: viewModel" class="popoverContainer form" role="form">\n',
        formHtmlSuffix: '\n</div>\n',
        titleHtml:
            '\n<div class="popover-form-header">\n' +
            '   <button type="button" class="close" data-dismiss="popover" data-bind="click: onCancelWrapper" aria-hidden="true">&times;</button>\n' +
            '   <h4 data-bind="if: options.enableTitle()" class="popover-form-title"><i data-bind="css: options.titleIconClass"></i>&nbsp;<span data-bind="text: options.titleText"></span></h4>\n' +
            '</div>\n',
        footerHtml:
            '\n<div class="popover-form-footer">\n' +
                '<button type="button" class="btn btn-xs" data-dismiss="popover" data-bind="text: options.cancelButtonText, click: onCancelWrapper, attr: { &quot;data-closeonesckey&quot;: options.closeOnEscKey }"></button>\n' +
                '<button type="button" accesskey="s" class="btn btn-primary btn-xs" data-bind="text: options.okButtonText, enable: options.okButtonEnabled, click: onOkWrapper"></button>\n' +
            '</div>\n'
        /* jshint +W110 */ //Mixed double and single quotes.
    };

    //Install global handler to close popovers on ESC
    $(document).on("keyup", function (e) {
        if (e.which === 27 && $.fn.popoverForm.defaults.closeOnEscKey) {   //ESC
            //Fire cancel event
            $(document).find("[data-dismiss=popover]").filter("[data-closeonesckey=true]").click();
        }
    });


}));