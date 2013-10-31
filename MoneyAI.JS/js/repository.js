define(['jquery'], function ($) {
    return {
        getTransactions: function (onGet, onFail) {
            var jqxhr = $.getJSON("data/LatestMerged.json", function (data, textStatus) {
                console.log(textStatus);
                onGet(data);
            })
          .fail(function (jqxhr, textStatus, error) {
              !!onFail && onFail(error);
              console.log(textStatus);
          })
          .always(function () {
              console.log("getTransactions complete");
          });
        }
    };
});
