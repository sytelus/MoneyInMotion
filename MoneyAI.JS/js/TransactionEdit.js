define("TransactionEdit", ["common/utils", "Transaction", "userProfile", "EditedValues"], function (utils, Transaction, userProfile, editedValues) {
    "use strict";

    //static privates
    var TransactionEdit = function (scope, sourceId, editValues) {
        this.auditInfo = userProfile.createAuditInfo();
        this.id = utils.createUUID();

        this.scope = scope;
        this.sourceId = userProfile.getEditsSourceId();
        this.values = new editedValues.EditedValues(editValues);
    };
    TransactionEdit.prototype.merge = function (otherEdit) {
        this.values.merge(otherEdit.values);
        this.auditInfo = userProfile.updateAuditInfo(this.auditInfo);
    };

    return TransactionEdit;
});