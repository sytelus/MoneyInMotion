define("userProfile", [], function () {
    "use strict";

    var getCurrentUserId = function () {
        return "test@gmail.com";   //TODO: return actual ID
    };

    //static privates
    var AuditInfo = function(previousAuditInfo) {
        if (!!previousAuditInfo) {
            this.createdBy = previousAuditInfo.createdBy;
            this.createDate = previousAuditInfo.createDate;
            this.updatedBy = getCurrentUserId();
            this.updateDate = new Date();
        }
        else {
            this.createdBy = getCurrentUserId();
            this.createDate = new Date();
        }
    };

    return {
        createAuditInfo: function () {
            return new AuditInfo();
        },

        updateAuditInfo: function (previousAuditInfo) {
            return new AuditInfo(previousAuditInfo);
        },

        getEditsSourceId: function() {
            //TODO: get proper sourceId
            return "Trial";
        }
    };
});