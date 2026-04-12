define("transactionReasonUtils", ["common/utils"], function (utils) {
    "use strict";

    //static privates
    var transactionReasonInfo = [
        { key: "Purchase", value: 0, title: "Purchase", pluralTitle: "Purchases", category: "Expense" },
        { key: "ExpenseAdjustment", value: 1 << 0, title: "Adjustment (Debit)", pluralTitle: "Adjustments (Debit)", category: "Expense" },
        { key: "Fee", value: 1 << 1, title: "Fee", pluralTitle: "Fees", category: "Expense" },
        { key: "InterAccountPayment", value: 1 << 2, title: "Account Payment", pluralTitle: "Account Payments", category: "InterAccount" },
        { key: "Return", value: 1 << 3, title: "Return", pluralTitle: "Returns", category: "Expense" },
        { key: "InterAccountTransfer", value: 1 << 4, title: "Transfer", pluralTitle: "Transfers", category: "InterAccount" },
        { key: "PointsCredit", value: 1 << 5, title: "Points", pluralTitle: "Points", category: "Income" },
        { key: "OtherCredit", value: 1 << 6, title: "Other (Credit)", pluralTitle: "Others (Credit)", category: "Income" },
        { key: "CheckPayment", value: 1 << 7, title: "Check", pluralTitle: "Checks", category: "Expense" },
        { key: "CheckRecieved", value: 1 << 8, title: "Check (Recieved)", pluralTitle: "Checks (Recieved)", category: "Income" },
        { key: "AtmWithdrawal", value: 1 << 9, title: "ATM", pluralTitle: "ATM", category: "Expense" },
        { key: "Interest", value: 1 << 10, title: "Interest", pluralTitle: "Interest", category: "Income" },
        { key: "LoanPayment", value: 1 << 11, title: "Loan", pluralTitle: "Loans", category: "Expense" },
        { key: "DiscountRecieved", value: 1 << 12, title: "Discount", pluralTitle: "Discounts", category: "Expense" },
        { key: "IncomeAdjustment", value: 1 << 13, title: "Adjustment (Credit)", pluralTitle: "Adjustments (Credit)", category: "Income" },
        { key: "MatchAdjustmentCredit", value: 1 << 14, title: "Match Adjustment (Credit)", pluralTitle: "Match Adjustments (Credit)", category: "Expense" },
        { key: "MatchAdjustmentDebit", value: 1 << 15, title: "Match Adjustment (Debit)", pluralTitle: "Match Adjustments (Debit)", category: "Expense" },
        { key: "PaymentRecieved", value: 1 << 16, title: "Payment Recieved", pluralTitle: "Payments Recieved", category: "Income" },
        { key: "CashAdvance", value: 1 << 17, title: "Cash Advance", pluralTitle: "Cash Advances", category: "Expense" }
    ];

    //public
    return {
        transactionReasonInfo: transactionReasonInfo,

        transactionReasonTitleLookup: (function () {
            return utils.toObject(transactionReasonInfo,
                function (item) { return item.value.toString(); },
                function (item) { return item.title.toString(); });
        })(),

        transactionReasonPluralTitleLookup: (function () {
            return utils.toObject(transactionReasonInfo,
                function (item) { return item.value.toString(); },
                function (item) { return item.pluralTitle.toString(); });
        })(),

        transactionReasonCategoryLookup: (function () {
            return utils.toObject(transactionReasonInfo,
                function (item) { return item.value.toString(); },
                function (item) { return item.category.toString(); });
        })()
    };
});