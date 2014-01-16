using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI.Repositories.StatementParsers
{
    internal class PayPalCsvParser : GenericStatementParser
    {
        public PayPalCsvParser(string filePath)
            : base(filePath, new string[] { ".csv", ".iif" })
        {
        }

        protected override StatementParserBase.StatementColumnType GetColumnType(string columnName)
        {
            return StatementColumnType.ProviderAttribute;
        }

        protected override void SetCalculatedAttributes(Transaction.ImportedValues importedValues)
        {
            base.SetCalculatedAttributes(importedValues);

            var dateTimeString = string.Concat(importedValues.ProviderAttributes[@"date"], " ", importedValues.ProviderAttributes[@"time"], " ", 
                Utils.GetTimeZoneHoursFromAbbreviation(importedValues.ProviderAttributes[@"time zone"]));
            importedValues.TransactionDate = DateTime.Parse(dateTimeString);    //TODO: handle local
            importedValues.EntityName = importedValues.ProviderAttributes[@"name"];
            importedValues.Amount = this.ParseAmount(importedValues.ProviderAttributes[@"amount"]);

            SetTransactionreason(importedValues);
        }

        private static void SetTransactionreason(Transaction.ImportedValues importedValues)
        {
            var ignorableActivity = false;
            switch (importedValues.ProviderAttributes[@"status"])
            {
                case "Denied":
                case "Removed":
                case "Placed":
                case "Canceled":
                case "Cleared":
                case "Failed":
                case "Refunded":
                    ignorableActivity = true;
                    break;
            }

            var payPalType = importedValues.ProviderAttributes[@"type"];

            if (!ignorableActivity)
            {
                if (payPalType.StartsWith("Update to ", StringComparison.InvariantCultureIgnoreCase) ||
                    payPalType.StartsWith("Cancelled", StringComparison.InvariantCultureIgnoreCase) ||
                    payPalType.StartsWith("Failed", StringComparison.InvariantCultureIgnoreCase) ||
                    payPalType.StartsWith("Denied", StringComparison.InvariantCultureIgnoreCase))
                {
                    ignorableActivity = true;
                }
                else
                {
                    switch (payPalType)
                    {
                        case "Authorization":
                        case "Temporary Hold":
                        case "Refund":
                            ignorableActivity = true;
                            break;
                    }
                }
            }

            if (!ignorableActivity)
            {
                if (payPalType.IndexOf("Payment Sent", StringComparison.InvariantCultureIgnoreCase) >= 0)
                    importedValues.TransactionReason = TransactionReason.Purchase;
                if (payPalType.IndexOf("Donation Sent", StringComparison.InvariantCultureIgnoreCase) >= 0)
                    importedValues.TransactionReason = TransactionReason.Purchase;
                if (payPalType.IndexOf("Charge From ", StringComparison.InvariantCultureIgnoreCase) >= 0 &&
                    payPalType.IndexOf("Card", StringComparison.InvariantCultureIgnoreCase) >= 0)
                    importedValues.TransactionReason = TransactionReason.InterAccountPayment;
                if (payPalType.IndexOf("Add Funds from a Bank Account", StringComparison.InvariantCultureIgnoreCase) >= 0)
                    importedValues.TransactionReason = TransactionReason.InterAccountTransfer;
                else
                {
                    switch (importedValues.ProviderAttributes[@"type"])
                    {
                        case "BillPay":
                            importedValues.TransactionReason = TransactionReason.Purchase;
                            break;
                        case "Payment Received":
                            importedValues.TransactionReason = TransactionReason.PayMentRecieved;
                            break;
                        default:
                            throw new Exception("Cannot determine TransactionReason for PayPal Type '{0}'".FormatEx(payPalType));
                    }
                }
            }
            else
                importedValues.TransactionReason = null;
        }

        protected override TransactionReason? InferTransactionReason(Transaction.ImportedValues importedValues)
        {
            return importedValues.TransactionReason;    //Disable default inference
        }

        protected override bool ValidateImportedValues(Transaction.ImportedValues importedValues)
        {
            if (importedValues.TransactionReason == null)
                return false;

            return base.ValidateImportedValues(importedValues);
        }
    }
}
