define('app', ["domReady", "repository", "jquery", "txExplorerView"], function (domReady, repository, $, txExplorerView) {
    "use strict";
    domReady(function () {
        txExplorerView.initialize();

        $("#log").text("<p>" + (new Date()) + "</p>");
        repository.getTransactions(function (data) {
            $("#log").after(data.Name + "<br/>" + data.items.length + "<br/>" + data.items[0].auditInfo.createDate + "<br/>" + new Date(data.items[0].auditInfo.createDate));

            txExplorerView.load(data);
        });
    });
});
