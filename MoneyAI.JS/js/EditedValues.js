define("EditedValues", ["common/utils", "knockout"], function (utils, ko) {
    "use strict";

    //static privates
    /************      EditScope  ***********/
    var scopeTypeLookup = {
        none: 0, all: 1, transactionId: 2,
        entityName: 3, entityNameNormalized: 4, entityNameAnyTokens: 5, entityNameAllTokens: 6,
        accountId: 7, transactionReason: 8, amountRange: 9
    },

    scopeTypeReverseLookup = {
        "0": "none", "1": "all", "2": "transactionId",
        "3": "entityName", "4": "entityNameNormalized", "5": "entityNameAnyTokens", "6": "entityNameAllTokens",
        "7": "accountId", "8": "transactionReason", "9": "amountRange"
    },

    minMaxParameterLength = {
        none: { min: 0, max: 0 }, all: { min: 0, max: 0 }, transactionId: { min: 1, max: utils.int32Max },
        entityNameNormalized: { min: 1, max: utils.int32Max }, entityNameAnyTokens: { min: 1, max: utils.int32Max }, entityNameAllTokens: { min: 1, max: utils.int32Max },
        accountId: { min: 1, max: utils.int32Max }, transactionReason: { min: 1, max: utils.int32Max }, amountRange: { min: 2, max: utils.int32Max }
    },

    validdateEditScope = function (scopeType, scopeParameters) {
        var errors = "";

        var paramLengths = minMaxParameterLength[scopeTypeReverseLookup[scopeType.toString()]];

        if (scopeParameters.length < paramLengths.min || scopeParameters.length > paramLengths.max) {
            errors += "ScopeType " + scopeType + " must have atleast " + paramLengths.min + " parameters and no more than " + paramLengths.max + " but it has " + scopeParameters.length;
        }

        return errors;
    };

    /************      EditScope  ***********/
    var EditScope = function (scopeType, scopeParameters) {
        var errors = validdateEditScope(scopeType, scopeParameters);
        if (errors !== "") {
            throw new Error(errors);
        }

        this.type = scopeType;
        this.parameters = scopeParameters;
    };

    /************  ScopeFilters view model  ***********/
    var getScopeFilterParameters = function (scopeFilters, scopeType) {
        var scopeFilter = utils.findFirst(scopeFilters, function (scopeFilter) { return scopeFilter.type === scopeType; });
        if (scopeFilter) {
            return scopeFilter.parameters;
        }
    },
    ScopeFiltersViewModel = function (scopeFilters, selectedTx) {
        var transactionIdParameters = getScopeFilterParameters(scopeFilters, scopeTypeLookup.transactionId);
        this.isTransactionIdFilter = ko.observable(transactionIdParameters !== undefined);
        this.transactionId = this.isTransactionIdFilter() ? transactionIdParameters : utils.distinct(utils.map(selectedTx, function (tx) { return tx.id; }));

        var accountIdParameters = getScopeFilterParameters(scopeFilters, scopeTypeLookup.accountId);
        this.isAccountIdFilter = ko.observable(accountIdParameters !== undefined);
        this.accountId = this.isAccountIdFilter() ? accountIdParameters : utils.distinct(utils.map(selectedTx, function (tx) { return tx.accountId; }));

        var transactionReasonParameters = getScopeFilterParameters(scopeFilters, scopeTypeLookup.transactionReason);
        this.isTransactionReasonFilter = ko.observable(transactionReasonParameters !== undefined);
        this.transactionReason = this.isTransactionReasonFilter() ? transactionReasonParameters : utils.distinct(utils.map(selectedTx, function (tx) { return tx.transactionReason; }));

        var entityNameNormalizedParameters = getScopeFilterParameters(scopeFilters, scopeTypeLookup.entityNameNormalized);
        this.isEntityNameNormalizedFilter = ko.observable(entityNameNormalizedParameters !== undefined);
        this.entityNameNormalized = this.isEntityNameNormalizedFilter() ? entityNameNormalizedParameters : utils.distinct(utils.map(selectedTx, function (tx) { return tx.entityNameNormalized; }));
        
        var entityNameAllTokensParameters = getScopeFilterParameters(scopeFilters, scopeTypeLookup.entityNameAllTokens);
        this.isEntityNameAllTokensFilter = ko.observable(entityNameAllTokensParameters !== undefined);
        this.entityNameAllTokens = this.isEntityNameAllTokensFilter() ? entityNameAllTokensParameters.join(" ") : selectedTx[0].entityNameNormalized;
        
        var amountRangeParameters = getScopeFilterParameters(scopeFilters, scopeTypeLookup.amountRange);
        this.isAmountRangeFilter = ko.observable(amountRangeParameters !== undefined);
        this.minAmount = this.isAmountRangeFilter() ? amountRangeParameters[0] :
            Math.abs((utils.min(selectedTx, function (tx) { return Math.abs(tx.amount); }).amount) * 0.9).toFixed(2);
        this.maxAmount = this.isAmountRangeFilter() ? amountRangeParameters[1] :
            Math.abs((utils.max(selectedTx, function (tx) { return Math.abs(tx.amount); }).amount) * 1.1).toFixed(2);
        this.amountTypeString = utils.min(selectedTx, function (tx) { return tx.correctedValues.amount; }) < 0 ? "expense" : "amount";
    };
    ScopeFiltersViewModel.prototype.toScopeFilters = function () {
        var scopeFilters = [];

        if (this.isTransactionIdFilter()) {
            scopeFilters.push(new EditScope(scopeTypeLookup.transactionId, this.transactionId));
        }
        if (this.isEntityNameNormalizedFilter()) {
            scopeFilters.push(new EditScope(scopeTypeLookup.entityNameNormalized, this.entityNameNormalized));
        }
        if (this.isEntityNameAllTokensFilter()) {
            scopeFilters.push(new EditScope(scopeTypeLookup.entityNameAllTokens, utils.splitWhiteSpace(this.entityNameAllTokens)));
        }
        if (this.isAmountRangeFilter()) {
            scopeFilters.push(new EditScope(scopeTypeLookup.amountRange, [this.minAmount.toString(), this.maxAmount.toString()]));
        }
        if (this.isAccountIdFilter()) {
            scopeFilters.push(new EditScope(scopeTypeLookup.accountId, this.accountId));
        }
        if (this.isTransactionReasonFilter()) {
            scopeFilters.push(new EditScope(scopeTypeLookup.transactionReason, this.transactionReason));
        }

        return scopeFilters;
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
        ScopeFiltersViewModel: ScopeFiltersViewModel,
        scopeTypeLookup: scopeTypeLookup,
        scopeTypeReverseLookup: scopeTypeReverseLookup
    };
});