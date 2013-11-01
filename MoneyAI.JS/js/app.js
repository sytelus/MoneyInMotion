define('app', ["domReady", "repository", "jquery"], function (domReady, repository, $) {
    "use strict";
    domReady(function () {
        repository.getTransactions(function (data) {
            $("#log").text(data.Name + "<br/>" + data.items.length + "<br/>" + data.items[0].auditInfo.createDate + "<br/>" + new Date(data.items[0].auditInfo.createDate));
        });
    });
});
