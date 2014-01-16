using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI.Repositories
{
    internal abstract class StatementParserBase
    {
        public enum StatementColumnType
        {
            TransactionDate, PostedDate, EntityName, TransactionReason, Amount,
            Ignore, InstituteReference, ProviderCategoryName, PhoneNumber, Address, SubAccountName,
            AccountNumber, CheckReference, DebitAmount, CreditAmount, ProviderAttribute
        }

        protected abstract IEnumerable<IEnumerable<KeyValuePair<string, string>>> GetTransactionProperties();

        public IEnumerable<Transaction.ImportedValues> GetTransactionImportedValues()
        {
            var lineNumber = 0;
            foreach(var txPropertyKvps in this.GetTransactionProperties())
            {
                var importedValues = new Transaction.ImportedValues() { LineNumber = ++lineNumber };
                foreach(var originalKvp in txPropertyKvps)
                {
                    var kvp = this.MapKeyValuePair(originalKvp);
                    var columnType = this.GetColumnType(kvp.Key);
                    this.SetImportedValueProperty(importedValues, columnType, kvp.Key, kvp.Value);
                }

                //If transaction reason is not set by any column then make a generic call to enable inferences
                importedValues.TransactionReason = this.InferTransactionReason(importedValues);

                this.SetCalculatedAttributes(importedValues);

                if (this.ValidateImportedValues(importedValues))
                    yield return importedValues;
            }
        }

        #region Derived class interface
        protected virtual KeyValuePair<string,string> MapKeyValuePair(KeyValuePair<string,string> kvp)
        {
            return kvp;
        }
        protected virtual bool ValidateImportedValues(Transaction.ImportedValues importedValues)
        {
            return true;
        }
        protected virtual void SetCalculatedAttributes(Transaction.ImportedValues importedValues)
        {
        }

        protected virtual TransactionReason? InferTransactionReason(Transaction.ImportedValues importedValues)
        {
            var amount = importedValues.Amount.Value;
            var entityName = importedValues.EntityName;
            var isCheck = !string.IsNullOrWhiteSpace(importedValues.CheckReference);

            if (importedValues.TransactionReason == TransactionReason.UnknownAdjustment)
            {
                importedValues.TransactionReason = amount >= 0 ? TransactionReason.IncomeAdjustment : TransactionReason.ExpenseAdjustment;
            }

            if (importedValues.TransactionReason == null
                || importedValues.TransactionReason == TransactionReason.Purchase)
            {
                if (amount < 0 && entityName != null && entityName.IndexOf("FEE", StringComparison.InvariantCultureIgnoreCase) >= 0)
                    return TransactionReason.Fee;
                else if (amount < 0 && entityName != null && entityName.IndexOf("ATM", StringComparison.InvariantCultureIgnoreCase) >= 0)
                    return TransactionReason.AtmWithdrawal;
                else if (amount < 0 && entityName != null && entityName.IndexOf("loan", StringComparison.InvariantCultureIgnoreCase) >= 0)
                    return TransactionReason.LoanPayment;
                else if (amount < 0 && isCheck)
                    return TransactionReason.CheckPayment;
                else if (amount < 0)
                    return TransactionReason.Purchase;
            }

            if (importedValues.TransactionReason == null
                || importedValues.TransactionReason == TransactionReason.OtherCredit)
            {
                if (amount > 0 && entityName != null && entityName.IndexOf("Interest", StringComparison.InvariantCultureIgnoreCase) >= 0)
                    return TransactionReason.Interest;
                else if (amount > 0 && entityName != null && entityName.IndexOf("POINTS CREDIT", StringComparison.InvariantCultureIgnoreCase) >= 0)
                    return TransactionReason.PointsCredit;
                else if (amount > 0 && entityName != null
                    && (entityName.IndexOf("refund", StringComparison.InvariantCultureIgnoreCase) >= 0
                        || entityName.IndexOf("return", StringComparison.InvariantCultureIgnoreCase) >= 0))
                    return TransactionReason.Return;
                else if (amount > 0 && isCheck)
                    return TransactionReason.CheckRecieved;
                else if (amount >= 0)
                    return TransactionReason.OtherCredit;
            }

            return importedValues.TransactionReason;
        }
        #endregion

        protected virtual StatementColumnType GetColumnType(string columnName)
        {
            switch (columnName)
            {
                case "type":
                    return StatementColumnType.TransactionReason;
                case "trans date":
                case "transaction date":
                case "date":
                    return StatementColumnType.TransactionDate;
                case "post date":
                    return StatementColumnType.PostedDate;
                case "description":
                case "title":
                case "payee":
                    return StatementColumnType.EntityName;
                case "amount":
                    return StatementColumnType.Amount;
                case "account":
                    return StatementColumnType.AccountNumber;
                case "chkref":
                    return StatementColumnType.CheckReference;
                case "category":
                    return StatementColumnType.ProviderCategoryName;
                case "debit":
                    return StatementColumnType.DebitAmount;
                case "credit":
                    return StatementColumnType.CreditAmount;
                case "reference":
                    return StatementColumnType.InstituteReference;
                case "":    //ending comma
                case "balance":
                    return StatementColumnType.Ignore;
                default:
                    return StatementColumnType.ProviderAttribute;
            }
        }

        private void SetImportedValueProperty(Transaction.ImportedValues importedValues, StatementColumnType columnType, string columnName, string columnValue)
        {
            switch (columnType)
            {
                case StatementColumnType.Amount:
                    importedValues.Amount = this.ParseAmount(columnValue);
                    break;
                case StatementColumnType.EntityName:
                    importedValues.EntityName = this.SetImportedValueText(importedValues.EntityName, columnValue, columnType);
                    break;
                case StatementColumnType.PostedDate:
                    importedValues.PostedDate = this.ParsePostednDate(columnValue);
                    break;
                case StatementColumnType.TransactionDate:
                    importedValues.TransactionDate = this.ParsePostednDate(columnValue);
                    break;
                case StatementColumnType.TransactionReason:
                    importedValues.TransactionReason = this.ParseTransactionReason(columnValue);
                    break;
                case StatementColumnType.InstituteReference:
                    importedValues.InstituteReference = this.SetImportedValueText(importedValues.InstituteReference, columnValue, columnType);
                    break;
                case StatementColumnType.ProviderCategoryName:
                    importedValues.ProviderCategoryName = this.SetImportedValueText(importedValues.ProviderCategoryName, columnValue, columnType);
                    break;
                case StatementColumnType.PhoneNumber:
                    importedValues.PhoneNumber = this.SetImportedValueText(importedValues.PhoneNumber, columnValue, columnType);
                    break;
                case StatementColumnType.Address:
                    importedValues.Address = this.SetImportedValueText(importedValues.Address, columnValue, columnType);
                    break;
                case StatementColumnType.SubAccountName:
                    importedValues.SubAccountName = this.SetImportedValueText(importedValues.SubAccountName, columnValue, columnType);
                    break;
                case StatementColumnType.AccountNumber:
                    importedValues.AccountNumber = this.SetImportedValueText(importedValues.AccountNumber, columnValue, columnType);
                    break;
                case StatementColumnType.CheckReference:
                    importedValues.CheckReference = this.SetImportedValueText(importedValues.CheckReference, columnValue, columnType);
                    break;
                case StatementColumnType.DebitAmount:
                    if (!string.IsNullOrWhiteSpace(columnValue))
                        importedValues.Amount = -1 * this.ParseAmount(columnValue);
                    break;
                case StatementColumnType.CreditAmount:
                    if (!string.IsNullOrWhiteSpace(columnValue))
                        importedValues.Amount = this.ParseAmount(columnValue);
                    break;
                case StatementColumnType.Ignore: break;
                case StatementColumnType.ProviderAttribute:
                    if (importedValues.ProviderAttributes == null)
                        importedValues.ProviderAttributes = new Dictionary<string, string>();
                    importedValues.ProviderAttributes[columnName] = columnValue;
                    break;
                default:
                    throw new Exception("Header column  type '{0}' for '{1}' with value '{2}' is not recognized".FormatEx(columnType, columnName, columnValue));
            }
        }

        #region Individual column parsing
        protected virtual string SetImportedValueText(string oldValue, string newValue, StatementColumnType columnType)
        {
            if (string.IsNullOrWhiteSpace(newValue))
            {
                if (!string.IsNullOrWhiteSpace(oldValue))
                    return oldValue;
                else
                    return null;
            }
            else
                return newValue;
        }
        protected virtual Decimal ParseAmount(string columnValue)
        {
            return Decimal.Parse(columnValue, NumberStyles.Currency);
        }
        protected virtual DateTime ParseTransactionDate(string columnValue)
        {
            return DateTime.Parse(columnValue, CultureInfo.CurrentCulture, DateTimeStyles.AssumeLocal);
        }
        protected virtual DateTime ParsePostednDate(string columnValue)
        {
            return DateTime.Parse(columnValue, CultureInfo.CurrentCulture, DateTimeStyles.AssumeLocal).ToUniversalTime();
        }
        protected virtual TransactionReason ParseTransactionReason(string columnValue)
        {
            if (columnValue == null)
                throw new ArgumentNullException(columnValue, "TransactionReason columnValue null is not supported by CsvParserBase. Inferences must be done in overriden classes.");

            int transactionreasonInt;
            if (int.TryParse(columnValue, out transactionreasonInt))
            {
                if (Enum.IsDefined(typeof(TransactionReason), transactionreasonInt))
                    return (TransactionReason)transactionreasonInt;
            }

            switch (columnValue.ToUpperInvariant())
            {
                case "SALE":
                    return TransactionReason.Purchase;
                case "PAYMENT":
                    return TransactionReason.InterAccountPayment;
                case "ADJUSTMENT":
                    return TransactionReason.UnknownAdjustment;
                case "RETURN":
                    return TransactionReason.Return;
                case "FEE":
                    return TransactionReason.Fee;
                default:
                    throw new ArgumentException("raw TransactionType {0} is not known".FormatEx(columnValue), "columnValue");
            }
        }
        #endregion

    }
}
