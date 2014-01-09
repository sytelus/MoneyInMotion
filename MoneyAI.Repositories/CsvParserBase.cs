using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;
using System.Globalization;

namespace MoneyAI.Repositories
{
    internal abstract class CsvParserBase
    {
        public virtual Transaction.ImportedValues GetTransactionImportedValues(string line)
        {
            if (this.IsBlank(line))
                return null;
            else
            {
                var columns = this.GetCsvColumns(line);

                if (this.ValidateColumns(columns))
                {
                    var processedColumns = this.ProcessRow(columns);

                    if (processedColumns == null)
                        return null;
                    else
                    {
                        var importedValues = this.GetImportedValues(columns);
                        return importedValues;
                    }
                }
                else return null;
            }
        }

        public class HeaderColumn
        {
            public string ColumnName {get;set;}
            public CsvColumnType ColumnType { get; set; }
        }

        protected HeaderColumn[] HeaderColumns { get; private set; }

        protected virtual bool ValidateColumns(string[] columns)
        {
            return true;
        }

        protected virtual string[] ProcessRow(string[] columns)
        {
            string[] transformedColumns;
            if (this.HeaderColumns == null)
            {
                this.HeaderColumns = this.GetHeaderColumns(columns, out transformedColumns);
            }
            else
                transformedColumns = this.TransformColumns(columns);
            
            return transformedColumns;
        }

        protected virtual string[] TransformColumns(string[] columns)
        {
            return columns;
        }

        protected virtual HeaderColumn[] GetHeaderColumns(string[] columns, out string[] transformedColumns)
        {
            transformedColumns = null;
            return columns
                .Select(columnName => columnName.ToLowerInvariant())
                .Select(columnNameCased => new HeaderColumn { ColumnName = columnNameCased, ColumnType = this.GetColumnType(columnNameCased) }).ToArray();
        }

        protected virtual CsvColumnType GetColumnType(string columnName)
        {
            switch (columnName)
            {
                case "type":
                    return CsvColumnType.TransactionReason; 
                case "trans date":
                case "transaction date":
                case "date":
                    return CsvColumnType.TransactionDate; 
                case "post date":
                    return CsvColumnType.PostedDate; 
                case "description":
                case "title":
                case "payee":
                    return CsvColumnType.EntityName; 
                case "amount":
                    return CsvColumnType.Amount; 
                case "account":
                    return CsvColumnType.AccountNumber;
                case "chkref":
                    return CsvColumnType.CheckReference;
                case "category":
                    return CsvColumnType.ProviderCategoryName;
                case "debit":
                    return CsvColumnType.DebitAmount;
                case "credit":
                    return CsvColumnType.CreditAmount;
                case "":    //ending comma
                case "balance":
                    return CsvColumnType.Ignore;
                default:
                    throw new Exception("Header column '{0}' is not recognized".FormatEx(columnName));
            }
        }

        protected virtual Transaction.ImportedValues GetImportedValues(string[] columns)
        {
            var importedValues = new Transaction.ImportedValues();
            for(var columnIndex = 0; columnIndex < columns.Length && columnIndex < this.HeaderColumns.Length; columnIndex++)
            {
                var columnValue = columns[columnIndex];
                var columnType = this.HeaderColumns[columnIndex].ColumnType;
                var columnName = this.HeaderColumns[columnIndex].ColumnName;
                switch(columnType)
                {
                    case CsvColumnType.Amount:
                        importedValues.Amount = this.ParseAmount(columnValue);
                        break;
                    case CsvColumnType.EntityName:
                        importedValues.EntityName = this.SetImportedValueText(importedValues.EntityName, columnValue, columnType);
                        break;
                    case CsvColumnType.PostedDate:
                        importedValues.PostedDate = this.ParsePostednDate(columnValue);
                        break;
                    case CsvColumnType.TransactionDate:
                        importedValues.TransactionDate = this.ParsePostednDate(columnValue);
                        break;
                    case CsvColumnType.TransactionReason:
                        importedValues.TransactionReason = this.ParseTransactionReason(columnValue, columns);
                        break;
                    case CsvColumnType.InstituteReference:
                        importedValues.InstituteReference = this.SetImportedValueText(importedValues.InstituteReference, columnValue, columnType);
                        break;
                    case CsvColumnType.ProviderCategoryName:
                        importedValues.ProviderCategoryName = this.SetImportedValueText(importedValues.ProviderCategoryName, columnValue, columnType);
                        break;
                    case CsvColumnType.PhoneNumber:
                        importedValues.PhoneNumber = this.SetImportedValueText(importedValues.PhoneNumber, columnValue, columnType);
                        break;
                    case CsvColumnType.Address:
                        importedValues.Address = this.SetImportedValueText(importedValues.Address, columnValue, columnType);
                        break;
                    case CsvColumnType.SubAccountName:
                        importedValues.SubAccountName = this.SetImportedValueText(importedValues.SubAccountName, columnValue, columnType);
                        break;
                    case CsvColumnType.OtherInfo:
                        importedValues.OtherInfo = this.SetImportedValueText(importedValues.OtherInfo, columnValue, columnType);
                        break;
                    case CsvColumnType.AccountNumber:
                        importedValues.AccountNumber = this.SetImportedValueText(importedValues.AccountNumber, columnValue, columnType);
                        break;
                    case CsvColumnType.CheckReference:
                        importedValues.CheckReference = this.SetImportedValueText(importedValues.CheckReference, columnValue, columnType);
                        break;
                    case CsvColumnType.DebitAmount:
                        if (!string.IsNullOrWhiteSpace(columnValue))
                            importedValues.Amount = -1 * this.ParseAmount(columnValue);
                        break;
                    case CsvColumnType.CreditAmount:
                        if (!string.IsNullOrWhiteSpace(columnValue))
                            importedValues.Amount = this.ParseAmount(columnValue);
                        break;
                    case CsvColumnType.Ignore: break;
                    case CsvColumnType.ProviderAttribute:
                        if (importedValues.ProviderAttributes == null)
                            importedValues.ProviderAttributes = new Dictionary<string, string>();
                        importedValues.ProviderAttributes[columnName] = columnValue;
                        break;
                    default:
                        throw new Exception("Header column  type '{0}' is not recognized".FormatEx(this.HeaderColumns[columnIndex]));
                }
            }


            //If transaction reason is not set by any column then make a generic call to enable inferences
            importedValues.TransactionReason = this.InferTransactionReason(importedValues, columns);

            this.SetCalculatedAttributes(importedValues, columns);

            importedValues = this.ValidateImportedValues(importedValues);

            return importedValues;
        }

        protected virtual Transaction.ImportedValues ValidateImportedValues(Transaction.ImportedValues importedValues)
        {
            return importedValues;
        }

        protected virtual void SetCalculatedAttributes(Transaction.ImportedValues importedValues, string[] columns)
        {
        }

        protected virtual TransactionReason? InferTransactionReason(Transaction.ImportedValues importedValues, string[] columnValues)
        {
            var amount = importedValues.Amount.Value;
            var entityName = importedValues.EntityName;
            var isCheck = !string.IsNullOrWhiteSpace(importedValues.CheckReference);

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
                else
                    return TransactionReason.Purchase;
            }
            else if (importedValues.TransactionReason == null
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
                else 
                    return TransactionReason.OtherCredit;
            }
            else 
                return importedValues.TransactionReason;
        }

        protected virtual string SetImportedValueText(string oldValue, string newValue, CsvColumnType columnType)
        {
            newValue = this.PreProcessColumnValue(newValue, columnType);

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

        protected virtual string PreProcessColumnValue(string columnValue, CsvColumnType columnType)
        {
            return columnValue;
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
            return DateTime.Parse(columnValue, CultureInfo.CurrentCulture, DateTimeStyles.AssumeLocal);
        }
        protected virtual TransactionReason ParseTransactionReason(string columnValue, string[] columnValues)
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
                    return TransactionReason.Adjustment;
                case "RETURN":
                    return TransactionReason.Return;
                case "FEE":
                    return TransactionReason.Fee;
                default:
                    throw new ArgumentException("raw TransactionType {0} is not known".FormatEx(columnValue), "columnValue");
            }
        }

        protected virtual string[] GetCsvColumns(string line)
        {
            return Utils.ParseCsvLine(line).ToArray();
        }

        protected virtual bool IsBlank(string line)
        {
            return string.IsNullOrWhiteSpace(line);
        }

        public enum CsvColumnType
        {
            TransactionDate, PostedDate, EntityName, TransactionReason, Amount, 
            Ignore, InstituteReference, ProviderCategoryName, PhoneNumber, Address, SubAccountName,
            OtherInfo, AccountNumber, CheckReference, DebitAmount, CreditAmount, ProviderAttribute
        }

        [Serializable]
        public class ValidationException : Exception
        {
            public int Severity { get; private set; }
            public ValidationException(int severity, string message)
                : base(message)
            {
                this.Severity = severity;
            }
        }
    }
}
