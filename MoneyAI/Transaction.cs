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
    public enum TransactionReason
    {
        Purchase, Adjustment, Fee, Payment, Return
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
        public TransactionEdit.EditedValues Edits { get; private set; }

        [DataMember(EmitDefaultValue = false)]
        public IDictionary<int,Tuple<string,string>> EditSequence { get; private set; }

        [DataMember(EmitDefaultValue = false)] private int editSequenceNumber;

        private string cachedEntityNameNormalized = null;
        public string EntityNameNormalized
        {
            get
            {
                if (cachedEntityNameNormalized == null)
                    cachedEntityNameNormalized = GetEntityNameNormalized(this.EntityName) ?? string.Empty;

                return cachedEntityNameNormalized;
            }
        }

        private readonly static Regex nonAlphaRegex = new Regex(@"[^\w\s\.]|[\d]", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private readonly static Regex multipleWhiteSpaceRegex = new Regex(@"[\s]+", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private readonly static Regex whiteSpaceRegex = new Regex(@"[\s]", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private static string GetEntityNameNormalized(string entityName)
        {
            //Ensure non-null name
            entityName = entityName ?? string.Empty;
            //Replace non-alpha chars with space
            var cleanedName = nonAlphaRegex.Replace(entityName, " ");
            //Replace white spaces such as tab/new lines with space
            cleanedName = multipleWhiteSpaceRegex.Replace(cleanedName, " ");
            //Combine multiple spaces to one
            cleanedName = whiteSpaceRegex.Replace(cleanedName, " ");
            //Trim extra spaces
            cleanedName = cleanedName.Trim();

            //Determine if we should convert to title case or lower case
            var hasAnyUpperCase = cleanedName.Any(Char.IsUpper);
            var hasAnyLowerCase = cleanedName.Any(Char.IsLower);
            //If mixed case then skip case conversion
            if (!(hasAnyLowerCase && hasAnyUpperCase))
            {
                var isAllUpperCase = !hasAnyLowerCase && cleanedName.All(c => Char.IsUpper(c) || !char.IsLetter(c));
                var hasDot = cleanedName.Contains('.'); //Posible .com names
                if (isAllUpperCase)
                    cleanedName = !hasDot ? cleanedName.ToTitleCase() : cleanedName.ToLower();
            }

            if (cleanedName.Length == 0)
                cleanedName = entityName.Trim().ToTitleCase();

            return cleanedName;
        }

        public void ApplyEdit(TransactionEdit edit)
        {
            this.Edits = this.Edits ?? new TransactionEdit.EditedValues();

            this.Edits.Merge(edit.Values);

            this.InvalidateCachedValues();

            this.RecordAppliedEdit(edit);
        }

        private void InvalidateCachedValues()
        {
            this.cachedDisplayCategory = null;
            this.cachedDisplayCategoryPath = null;
            this.cachedEntityNameNormalized = null;
        }

        private void RecordAppliedEdit(TransactionEdit edit)
        {
            this.EditSequence = this.EditSequence ?? new Dictionary<int, Tuple<string, string>>();
            this.editSequenceNumber += 1;
            this.EditSequence.Add(this.editSequenceNumber, Tuple.Create(edit.SourceId, edit.Scope.Id));
        }

        private Transaction()
        {
            this.AuditInfo = AuditInfo.Create();
        }

        public static Transaction CreateFromCsvLine(string[] headerColumns, string line, string accountId, string importId, int lineNumber)
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
                , this.PostDate.IfNotNullValue(p => p.Value.ToString("u")), this.TransactionDate.ToString("u"));
        }

        private void Validate()
        {
            var errors = string.Empty;
            if (this.ImportId == null)
                errors += "LocationHash must have value.";
            if (string.IsNullOrEmpty(this.AccountId))
                errors += "AccountInfo.Id must have value.";
            if (this.amount == null)
                errors += "Amount must have value.";
            if (this.transactionDate == null)
                errors += "TransactionDate must have value.";
            if (string.IsNullOrEmpty(this.EntityName))
                errors += "EntityName must have value.";

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
                    return TransactionReason.Payment;
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
