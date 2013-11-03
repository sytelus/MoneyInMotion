define('app', ["domReady", "repository", "jquery"], function (domReady, repository, $) {
    "use strict";
    domReady(function () {
        $("#log").text("<p>" + (new Date()) + "</p>");
        repository.getTransactions(function (data) {
            $("#log").after(data.Name + "<br/>" + data.items.length + "<br/>" + data.items[0].auditInfo.createDate + "<br/>" + new Date(data.items[0].auditInfo.createDate));
        });
    });
});
