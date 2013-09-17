using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Security.Claims;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using CommonUtils;

namespace MoneyAI
{
    [Flags]
    public enum TransactionReason
    {
        Purchase = 0, 
        Adjustment = 1, 
        Fee = 2, 
        InterAccountPayment = 4, 
        Return = 8,
        InterAccountTransfer = 16,

        NetOutgoing = Purchase | Fee,
        NetIncoming = Return,
        NetInterAccount = InterAccountPayment | InterAccountTransfer
    }

    [DataContract]
    public partial class Transaction
    {
        [DataMember(IsRequired = true)]
        public TransactionReason TransactionReason { get; private set; }

        [DataMember(IsRequired = true)]
        private DateTime? transactionDate;
        public DateTime TransactionDate
        {
            get { return this.transactionDate.Value; }
        }

        [DataMember(EmitDefaultValue = false)]
        public DateTime? PostDate { get; private set; }

        [DataMember(IsRequired = true)]
        public string EntityName { get; private set; }

        [DataMember(IsRequired = true)]
        private decimal? amount;
        public decimal Amount { get { return this.amount.Value; } }

        [DataMember(IsRequired = true)]
        public string ContentHash { get; private set; }

        [DataMember(IsRequired = true)]
        public string AccountId { get; private set; }

        [DataMember(IsRequired = true)]
        public string ImportId { get; private set; }

        [DataMember(IsRequired = true)]
        public AuditInfo AuditInfo { get; private set; }

        [DataMember(IsRequired = true)] 
        public string Id { get; private set; }       

        [DataMember(IsRequired = true)] 
        public int LineNumber { get; private set; }     

        [DataMember(EmitDefaultValue = false)]
        public TransactionEdit.EditedValues MergedEdit { get; private set; }

        [DataMember(EmitDefaultValue = false)]
        internal LinkedList<string> AppliedEditIdsDescending { get; private set; }

        public Transaction Clone()
        {
            var serializedData = JsonSerializer<Transaction>.Serialize(this);
            return JsonSerializer<Transaction>.Deserialize(serializedData);
        }

        //This is kept internal because otherwise edit won't get tracked
        internal void ApplyEdit(TransactionEdit edit)
        {
            if (this.MergedEdit == null)
            {
                this.MergedEdit = new TransactionEdit.EditedValues(edit.Values);
                this.AppliedEditIdsDescending = new LinkedList<string>();
            }
            else
                this.MergedEdit.Merge(edit.Values);

            this.InvalidateCachedValues();

            this.AuditInfo = new AuditInfo(this.AuditInfo, true);

            this.AppliedEditIdsDescending.AddItemFirst(edit.Id);
        }

        private void InvalidateCachedValues()
        {
            this.cachedDisplayCategory = null;
            this.cachedCategoryPath = null;
            this.cachedEntityNameNormalized = null;
        }

        private Transaction()
        {
            this.AuditInfo = new AuditInfo();
        }

        //We only allow to create instance through the parent collection
        internal static Transaction CreateFromCsvLine(string[] headerColumns, string line, string accountId, string importId, int lineNumber)
        {
            var transaction = new Transaction();
            transaction.ImportId = importId;
            transaction.AccountId = accountId;
            var columns = Utils.ParseCsvLine(line).ToArray();
            for (var columnIndex = 0; columnIndex < headerColumns.Length; columnIndex++)
            {
                var headerColumn = headerColumns[columnIndex];
                var columnValue = columns[columnIndex];
                switch (headerColumn)
                {
                    case "Type":
                        transaction.TransactionReason = GetTransactionType(columnValue); break;
                    case "Trans Date":
                        transaction.transactionDate = DateTime.Parse(columnValue, CultureInfo.CurrentCulture, DateTimeStyles.AssumeLocal); break;
                    case "Post Date":
                        transaction.PostDate = DateTime.Parse(columnValue, CultureInfo.CurrentCulture, DateTimeStyles.AssumeLocal); break;
                    case "Description":
                        transaction.EntityName = columnValue; break;
                    case "Amount":
                        transaction.amount = Decimal.Parse(columnValue, NumberStyles.Currency); break;
                    default:
                        throw new Exception("Heade column '{0}' is not recognized".FormatEx(headerColumn));
                }
            }
            transaction.LineNumber = lineNumber;
            transaction.ContentHash = Utils.GetMD5HashString(string.Join("\t", transaction.GetContent()));
            transaction.Id = Utils.GetMD5HashString(string.Join("\t", transaction.GetContent().Concat(lineNumber.ToStringInvariant())));

            transaction.Validate();
            return transaction;
        }

        private IEnumerable<string> GetContent()
        {
            return Utils.AsEnumerable(
                this.AccountId, this.TransactionReason.ToString(),
                this.Amount.ToString(), this.EntityName.EmptyIfNull().ToUpperInvariant()
                , this.PostDate.IfNotNullValue(p => p.ToString("u")), this.TransactionDate.ToString("u"));
        }

        private void Validate()
        {
            var errors = string.Empty;
            if (this.ImportId == null)
                errors.Append("ImportId must have value.", " ");
            if (string.IsNullOrEmpty(this.AccountId))
                errors.Append("AccountId must have value.", " ");
            if (this.amount == null)
                errors.Append("Amount must have value.", " ");
            if (this.transactionDate == null)
                errors.Append("TransactionDate must have value.", " ");
            if (string.IsNullOrEmpty(this.EntityName))
                errors.Append("EntityName must have value.", " ");

            if (!string.IsNullOrEmpty(errors))
                throw new InvalidDataException(errors);
        }

        private static TransactionReason GetTransactionType(string rawTransactionType)
        {
            switch (rawTransactionType.ToUpperInvariant())
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
                    throw new ArgumentException("rawTransactionType {0} is not known".FormatEx(rawTransactionType), "rawTransactionType");
            }
        }

        public string SerializeToJson()
        {
            return JsonSerializer<Transaction>.Serialize(this);
        }
        public static Transaction DeserializeFromJson(string serializedData)
        {
            return JsonSerializer<Transaction>.Deserialize(serializedData);
        }
    }
}
