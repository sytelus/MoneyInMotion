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

    var getMappedCssLevel = function (level) {
        //Bootstrap maping
        switch (level) {
            case "error": return "danger";
            case "log": return "info";
            default:
                return level;
        }
    },

    getDefaultCloseAfter = function (level) {
        switch (level) {
            case "error": return $.fn.statusBox.defaults.autoCloseOnError ? $.fn.statusBox.defaults.closeAfter : undefined;
            case "warning": return $.fn.statusBox.defaults.autoCloseOnWarning ? $.fn.statusBox.defaults.closeAfter : undefined;
            case "info": return $.fn.statusBox.defaults.autoCloseOnInfo ? $.fn.statusBox.defaults.closeAfter : undefined;
            case "success": return $.fn.statusBox.defaults.autoCloseOnSuccess ? $.fn.statusBox.defaults.closeAfter : undefined;
            default:
                return $.fn.statusBox.defaults.closeAfter;
        }
    },

    Alert = function (key, text, level, priority, closeAfter) {
        var self = this;

        self.key = key;
        self.text = ko.observable(text || "(no status)");
        self.priority = ko.observable(priority === undefined ? $.fn.statusBox.defaults.priority : priority);
        self.level = ko.observable(level === undefined ? $.fn.statusBox.defaults.level : level);
        
        self.closeAfter = ko.observable(closeAfter === undefined ? getDefaultCloseAfter(level) : closeAfter);
        

        self.cssClass = ko.computed(function () {
            return "alert alert-" + getMappedCssLevel(self.level()) +
                ($.fn.statusBox.defaults.animation ? " fade in" : "");
        });
    };

    var viewModel = {
        alerts: ko.observableArray(),
        afterElementAdd: function (element) {
            //element.alert();
        },
        beforeElementRemove: function (element) {
            //element.alert("close");
        }
    },
    setAlertTimeOut = function (alert) {
        //window.clearTimeout(alert.timeOutHandle);
        alert.timeOutHandle = window.setTimeout(function () {
            viewModel.alerts.remove(alert);
            console.log(["REMOVED", alert.level(), alert.text(), alert.closeAfter()]);
        }, alert.closeAfter());
        console.log([alert.level(), alert.text(), alert.closeAfter()]);
    },
    statusUpdateHandler = function (event, text, level, priority, key, closeAfter) {
        if (level === "info" && priority < $.fn.statusBox.defaults.minPriorityForInfo) {
            return;
        }

        var alert = ko.utils.arrayFirst(viewModel.alerts, function (alert) { return alert.key === key; });
        if (!alert) {
            alert = new Alert(key, text, level, priority, closeAfter);
            viewModel.alerts.push(alert);

            if (alert.closeAfter() > 0) {
                setAlertTimeOut(alert);
            }
        }
        else {
            if (text !== undefined) {
                alert.text(text);
            }
            if (level !== undefined) {
                alert.level(level);
            }
            if (closeAfter !== undefined) {
                alert.closeAfter(closeAfter);
                setAlertTimeOut(alert);
            }
            if (priority !== undefined) {
                alert.priority(priority);
            }
        }
    };

    $.fn.statusBox = function () {
        var container = $(this);
        container.html($.fn.statusBox.defaults.htmlTemplate);

        ko.applyBindings(viewModel, container[0]);

        return container;
    };

    $.fn.statusBox.defaults = {
        closeOnEscKey: true,
        animation: true,
        closeAfter: 4000,
        level: "info",
        priority: 0,
        minPriorityForInfo: 0,
        autoCloseOnError: false,
        autoCloseOnWarning: false,
        autoCloseOnInfo: true,
        autoCloseOnSuccess: true,
        statusBoxUpdateEventName: "statusBoxUpdate",
        /* jshint -W110 */ //Mixed double and single quotes.
        htmlTemplate:
            '\n<div data-bind="foreach: {data: alerts, afterAdd: afterElementAdd, beforeRemove: beforeElementRemove}">\n' +
                '<div data-bind="css: cssClass">\n' +
                    '<button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>\n' +
                    '<span data-bind="text: text" />\n' +
                '</div>\n' +
            '</div>\n'
        /* jshint +W110 */ //Mixed double and single quotes.
    };

    //Install global handler to close popovers on ESC
    $(document).on("keyup", function (e) {
        if (e.which === 27 && $.fn.statusBox.defaults.closeOnEscKey) {   //ESC
            //Fire cancel event
            $(document).find("[data-dismiss=popover]").filter("[data-closeonesckey=true]").click();
        }
    });

    //Subscribe to event
    $(document).on($.fn.statusBox.defaults.statusBoxUpdateEventName, statusUpdateHandler);

}));