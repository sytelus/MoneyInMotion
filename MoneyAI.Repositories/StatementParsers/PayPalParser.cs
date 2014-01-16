using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI.Repositories.StatementParsers
{
    internal class PayPalParser : GenericStatementParser
    {
        public PayPalParser(string filePath)
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

            var dateString = importedValues.ProviderAttributes.GetValueOrDefault(@"date");
            var timeZoneAbbreviation = importedValues.ProviderAttributes.GetValueOrDefault(@"time zone");
            string timeZoneHoursString = null;
            if (!string.IsNullOrWhiteSpace(timeZoneAbbreviation))
                timeZoneHoursString = Utils.GetTimeZoneHoursFromAbbreviation(timeZoneAbbreviation);
            var timeString = importedValues.ProviderAttributes.GetValueOrDefault(@"time");

            var dateTimeString = string.Concat(dateString, " ", timeString, " ", timeZoneHoursString);
            importedValues.TransactionDate = DateTime.Parse(dateTimeString);    //TODO: handle local

            var memo = importedValues.ProviderAttributes.GetValueOrDefault(@"memo");
            var name = importedValues.ProviderAttributes.GetValueOrDefault(@"name");
            importedValues.EntityName =  (!string.IsNullOrWhiteSpace(memo) ? string.Concat(memo, " - ", name) : name);

            var amountString = importedValues.ProviderAttributes.GetValueOrDefault(@"amount");
            importedValues.Amount = this.ParseAmount(importedValues.ProviderAttributes[@"amount"]);

            var payPalType = importedValues.ProviderAttributes.GetValueOrDefault(@"type") ??    //CSV format
                importedValues.ProviderAttributes.GetValueOrDefault(@"class");  //IIF format

            SetTransactionreason(importedValues, payPalType);

            importedValues.ContentHash = Transaction.GetContentHash(
                Utils.AsEnumerable(name, dateString, amountString, payPalType).Select(s => s.ToUpperInvariant()));
        }

        private static void SetTransactionreason(Transaction.ImportedValues importedValues, string payPalType)
        {
            var ignorableActivity = false;
            switch (importedValues.ProviderAttributes.GetValueOrDefault(@"status"))
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
                            ignorableActivity = true;
                            break;
                    }
                }
            }

            if (!ignorableActivity)
            {
                if (payPalType.IndexOf("Payment Sent", StringComparison.InvariantCultureIgnoreCase) >= 0)
                    importedValues.TransactionReason = TransactionReason.Purchase;
                else if (payPalType.IndexOf("Donation Sent", StringComparison.InvariantCultureIgnoreCase) >= 0)
                    importedValues.TransactionReason = TransactionReason.Purchase;
                else if (payPalType.IndexOf("Refund", StringComparison.InvariantCultureIgnoreCase) >= 0)
                    importedValues.TransactionReason = TransactionReason.Return;
                else if (payPalType.IndexOf("Charge From ", StringComparison.InvariantCultureIgnoreCase) >= 0 &&
                    payPalType.IndexOf("Card", StringComparison.InvariantCultureIgnoreCase) >= 0)
                    importedValues.TransactionReason = TransactionReason.InterAccountPayment;
                else if (payPalType.IndexOf("Credit To ", StringComparison.InvariantCultureIgnoreCase) >= 0 &&
                    payPalType.IndexOf("Card", StringComparison.InvariantCultureIgnoreCase) >= 0)
                    importedValues.TransactionReason = TransactionReason.InterAccountTransfer;
                else if (payPalType.IndexOf("Add Funds from a Bank Account", StringComparison.InvariantCultureIgnoreCase) >= 0)
                    importedValues.TransactionReason = TransactionReason.InterAccountTransfer;
                else
                {
                    switch (payPalType)
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
