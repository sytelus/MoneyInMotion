define(["jquery"], function ($) {
    "use strict";
    return {
        getTransactions: function (onGet, onFail) {
            $.getJSON("data/LatestMerged.json", function (data, textStatus) {
                console.log(textStatus);
                onGet(data);
            })
            .fail(function (jqxhr, textStatus, error) {
                if (!!onFail) {
                    onFail(error);
                }
                console.log(textStatus);
            })
            .always(function () {
                console.log("getTransactions complete");
            });
        }
    };
});
