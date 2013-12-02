define("EditedValues", ["common/utils"], function (utils) {
    "use strict";

    //static privates
    /************      EditScope  ***********/
    var scopeTypeLookup = {
        none: 0, all: 1,
        entityName: 2, entityNameNormalized: 3, entityNameAnyTokens: 4,
        transactionId: 100
    },
    validdateEditScope = function (scopeType, scopeParameters) {
        var errors = "";
        switch (scopeType) {
            case scopeTypeLookup.transactionId:
                errors += (utils.isEmpty(scopeParameters)) ? "One or more scope parameters are required" : ""; break;
            case scopeTypeLookup.entityName:
                errors += (utils.isEmpty(scopeParameters)) ? "Only one scope parameters are required" : ""; break;
            case scopeTypeLookup.entityNameAnyTokens:
                errors += (utils.isEmpty(scopeParameters)) ? "One or more scope parameters are required" : ""; break;
            case scopeTypeLookup.entityNameNormalized:
                errors += (utils.isEmpty(scopeParameters)) ? "Only one scope parameters are required" : ""; break;
            case scopeTypeLookup.none:
                errors += (utils.isEmpty(scopeParameters)) ? "" : "zero scope parameters are expected"; break;
            case scopeTypeLookup.all:
                errors += (utils.isEmpty(scopeParameters)) ? "" : "zero scope parameters are expected"; break;
            default:
                throw new Error("scopeType " + scopeType + " is not supported");
        }

        return errors;
    };

    var EditScope = function (scopeType, scopeParameters) {
        var errors = validdateEditScope(scopeType, scopeParameters);
        if (errors !== "") {
            throw new Error(errors);
        }

        this.type = scopeType;
        this.parameters = scopeParameters;
    };

    /************      EditValue  ***********/
    var EditValue = function (value, isVoided) {
        this.value = value;
        this.isVoided = !!isVoided;
    };
    EditValue.prototype.getValueOrDefault = function (defaultValue) {
        return !this.isVoided ? this.value : defaultValue;
    };
    EditValue.voidedEditValue = function (defaultValue) {
        return new EditValue(defaultValue, true);
    };

    /************      EditedValues  ***********/
    var EditedValues = function (cloneFrom) {
        if (cloneFrom) {
            //Below are of type EditValue
            this.transactionReason = cloneFrom.transactionReason;
            this.transactionDate = cloneFrom.transactionDate;
            this.amount = cloneFrom.amount;
            this.entityName = cloneFrom.entityName;
            this.isFlagged = cloneFrom.isFlagged;
            this.note = cloneFrom.note;
            this.categoryPath = cloneFrom.categoryPath;
        }
        //else leave everything as undefined
    };
    EditedValues.prototype.merge = function (otherEditedValues) {
        // There are 3 possibilities for user intent:
        // 1. Apply my new value to existing edit. 
        // 2. Leave current edited value alone.
        // 3. Remove any existing edited value and restore to original.
        // 
        // #1 is covered when EditValue is not null and IsVoided is false.
        // #2 is covered when EditValue object is null.
        // #3 is covered when EditValue is not null and IsVoided is true.

        if (otherEditedValues.transactionReason) {
            this.transactionReason = otherEditedValues.transactionReason.isVoided ? undefined : otherEditedValues.transactionReason;
        }

        if (otherEditedValues.transactionDate) {
            this.transactionDate = otherEditedValues.transactionDate.isVoided ? undefined : otherEditedValues.transactionDate;
        }

        if (otherEditedValues.Amount) {
            this.Amount = otherEditedValues.Amount.isVoided ? undefined : otherEditedValues.Amount;
        }

        if (otherEditedValues.entityName) {
            this.entityName = otherEditedValues.entityName.isVoided ? undefined : otherEditedValues.entityName;
        }

        if (otherEditedValues.isFlagged) {
            this.isFlagged = otherEditedValues.isFlagged.isVoided ? undefined : otherEditedValues.isFlagged;
        }

        if (otherEditedValues.note) {
            this.note = otherEditedValues.note.isVoided ? undefined : otherEditedValues.note;
        }

        if (otherEditedValues.categoryPath) {
            this.categoryPath = otherEditedValues.categoryPath.isVoided ? undefined : otherEditedValues.categoryPath;
        }
    };

    return {
        EditedValues: EditedValues,
        EditValue: EditValue,
        EditScope: EditScope,
        scopeTypeLookup: scopeTypeLookup
    };
});