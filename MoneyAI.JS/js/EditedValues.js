define("EditedValues", ["common/utils", "knockout", "transactionReasonUtils"], function (utils, ko, transactionReasonUtils) {
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

    parametersConstraints = {
        none: { min: 0, max: 0 }, all: { min: 0, max: 0 }, transactionId: { min: 1, max: utils.int32Max },
        entityNameNormalized: { min: 1, max: utils.int32Max, referenceParams: true },
        entityNameAnyTokens: { min: 1, max: utils.int32Max, referenceParams: true },
        entityNameAllTokens: { min: 1, max: utils.int32Max, referenceParams: false },
        accountId: { min: 1, max: utils.int32Max }, transactionReason: { min: 1, max: utils.int32Max }, amountRange: { min: 2, max: utils.int32Max }
    },

    validateEditScope = function (scopeType, scopeParameters, scopeReferenceParameters) {
        var errors = "";

        var constraints = parametersConstraints[scopeTypeReverseLookup[scopeType.toString()]];

        if (scopeParameters.length < constraints.min || scopeParameters.length > constraints.max) {
            errors += "ScopeType " + scopeType + " must have atleast " + constraints.min + " parameters and no more than " + constraints.max + " but it has " + scopeParameters.length;
        }

        if (constraints.referenceParams && (!scopeReferenceParameters || scopeReferenceParameters.length !== scopeParameters.length)) {
            errors += "ScopeType " + scopeType + " must have referenceParameters of same length as scope parameters";
        }

        return errors;
    };

    /************      EditScope  ***********/
    var EditScope = function (scopeType, scopeParameters, scopeReferenceParameters) {
        var errors = validateEditScope(scopeType, scopeParameters, scopeReferenceParameters);
        if (errors !== "") {
            throw new Error(errors);
        }

        this.type = scopeType;
        this.parameters = scopeParameters;
        this.referenceParameters = scopeReferenceParameters;
        this.contentHash = utils.getMD5Hash(scopeParameters.concat(scopeType.toString()).join("\t"));
    };

    /************  ScopeFilters view model  ***********/
    var setScopeFilterProperties = function (scopeFilters, scopeType, selectedTx, parameterAttributeNameOrFunction, referenceAttributeName, propertyName) {
        var scopeFilter = utils.findFirst(scopeFilters, function (scopeFilter) { return scopeFilter.type === scopeType; });
        var isFilter = !!(scopeFilter && scopeFilter.parameters);
        var parameters = isFilter ? scopeFilter.parameters : (
            utils.isFunction(parameterAttributeNameOrFunction) ? parameterAttributeNameOrFunction.call(this, selectedTx)
                : utils.distinct(utils.map(selectedTx, parameterAttributeNameOrFunction)));
        var referenceParameters = isFilter ? scopeFilter.referenceParameters : (
            referenceAttributeName ? utils.distinct(utils.map(selectedTx, referenceAttributeName)) : undefined);

        this.filters = this.filters || {};
        this.filters[propertyName] = {
            isFilter: ko.observable(isFilter), parameters: parameters, referenceParameters: referenceParameters, scopeType: scopeType
        };
    },
    ScopeFiltersViewModel = function (scopeFilters, selectedTx) {
        setScopeFilterProperties.call(this, scopeFilters, scopeTypeLookup.accountId, selectedTx, "accountId", undefined, "accountId");

        setScopeFilterProperties.call(this, scopeFilters, scopeTypeLookup.entityNameNormalized, selectedTx, "entityNameNormalized", "entityName", "entityNameNormalized");
        setScopeFilterProperties.call(this, scopeFilters, scopeTypeLookup.transactionId, selectedTx, "id", undefined, "id");

        setScopeFilterProperties.call(this, scopeFilters, scopeTypeLookup.entityNameAllTokens, selectedTx,
            function (selectedTx) { return utils.splitWhiteSpace(selectedTx[0].entityNameNormalized); },
            "entityName", "entityNameAllTokens");
        this.filters.entityNameAllTokens.concatenatedTokens = ko.computed({
            read: function () {
                return this.filters.entityNameAllTokens.parameters.join(" ");
            },
            write: function (value) {
                this.filters.entityNameAllTokens.parameters = utils.splitWhiteSpace(value);
            },
            owner: this
        });

        this.filters.id.isFilterValue = this.filters.entityNameAllTokens.isFilterValue = ko.computed({
            read: function () { return this.filters.id.isFilter() ? "idFilter" : (this.filters.entityNameAllTokens.isFilter() ? "entityNameAllTokensFilter" : undefined); },
            write: function (value) {
                this.filters.id.isFilter(value === "idFilter");
                this.filters.entityNameAllTokens.isFilter(value === "entityNameAllTokensFilter");
            },
            owner: this
        });


        setScopeFilterProperties.call(this, scopeFilters, scopeTypeLookup.transactionReason, selectedTx, "transactionReason", undefined, "transactionReason");
        this.filters.transactionReason.titles = utils.map(this.filters.transactionReason.parameters,
            function (trCode) {
                return transactionReasonUtils.transactionReasonTitleLookup[trCode.toString()];
            });


        var isNegativeAmount = utils.min(selectedTx, function (tx) { return tx.correctedValues.amount; }).correctedValues.amount < 0;
        setScopeFilterProperties.call(this, scopeFilters, scopeTypeLookup.amountRange, selectedTx,
            function (selectedTx) {
                return [
                    Math.abs((utils.min(selectedTx, function (tx) { return Math.abs(tx.amount); }).amount) * 0.9).toFixed(0),
                    Math.abs((utils.max(selectedTx, function (tx) { return Math.abs(tx.amount); }).amount) * 1.1).toFixed(0),
                    isNegativeAmount.toString()];
            },
            undefined, "amountRange");
        this.filters.amountRange.amountTypeString = isNegativeAmount ? "expense" : "amount";

        this.selectedTx = selectedTx;
    };
    ScopeFiltersViewModel.prototype.toScopeFilters = function () {
        var scopeFilters = [];
        
        utils.forEach(this.filters, function (filterPropertyValue) {
            if (filterPropertyValue.isFilter()) {
                scopeFilters.push(new EditScope(filterPropertyValue.scopeType, filterPropertyValue.parameters, filterPropertyValue.referenceParameters));
            }
        });

        return scopeFilters;
    };

    /************      EditValue  ***********/
    var EditValue = function (value, isVoided) {
        this.value = value;
        this.isVoided = !!isVoided;
    };
    EditValue.prototype.getValueOrDefault = function (defaultValue) {
        return (this && !this.isVoided) ? this.value : defaultValue;
    };
    EditValue.voidedEditValue = function (defaultValue) {
        return new EditValue(defaultValue, true);
    };

    /************      EditedValues  ***********/
    var EditedValues = function (cloneFrom) {
        if (cloneFrom) {
            //WARNING: Below are of type EditValue
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
    EditedValues.prototype.isUnvoided = function (valueNames) {
        if (utils.isString(valueNames)) {
            valueNames = [valueNames];
        }

        return utils.any(valueNames, function (valueName) {
            return this[valueName] && !this[valueName].isVoided;
        }, this);
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

        if (otherEditedValues.amount) {
            this.amount = otherEditedValues.amount.isVoided ? undefined : otherEditedValues.amount;
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