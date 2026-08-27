/*jshint -W098 */ //'opts' is defined but never used

//TODO: replace myJqueryPlugin with plugin name
(function (factory) {
    "use strict";

    if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define(["jquery"], factory);
    } else {
        // Browser globals
        factory(jQuery);
    }
}(function ($) {
    "use strict";
    $.fn.myJqueryPlugin = function (options) {
        var opts = $.extend({}, $.fn.myJqueryPlugin.defaults, options);
        return this.each(function () {
            //TODO: plugin code here
        });
    };

    $.fn.myJqueryPlugin.defaults = {
        //TODO: plugin defaults here
    };
}));