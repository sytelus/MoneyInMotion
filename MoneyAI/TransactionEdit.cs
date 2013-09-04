using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI
{
    public enum TransactionEditScope
    {
        EntityName, EntityNameNormalized, TransactionID, All, None
    }
    
    [DataContract]
    public class TransactionEdit
    {
        [DataMember(IsRequired = true)]
        public TransactionEditScope Scope { get; private set; }

        [DataMember(EmitDefaultValue = false)]
        public string[] ScopeParameters { get; private set; }

        [DataMember(EmitDefaultValue = false)]
        public string[] CategoryPath { get; private set; }

        [DataMember(EmitDefaultValue = false)]
        public Transaction.Correction UserCorrection { get; private set; }

        [DataMember(IsRequired = true)]
        public AuditInfo AuditInfo { get; private set; }

        [DataMember(IsRequired = true)]
        public string ContentHash { get; private set; }

        private TransactionEdit()
        {
            this.AuditInfo = AuditInfo.Create();
        }

        public static TransactionEdit CreateEditForEntityNameNormalizedCategoryAssignment(string entityNameNormalized,
            string[] categoryPath)
        {
            var edit = new TransactionEdit()
                       {
                           Scope = TransactionEditScope.EntityNameNormalized,
                           ScopeParameters = new[] { entityNameNormalized },
                           CategoryPath = categoryPath ?? new string[] { }
                       };
            edit.ContentHash = Utils.GetMD5HashString(string.Join("\t", edit.GetContent()));
            return edit;
        }

        internal void Apply(Transactions transactions)
        {
            var filteredTransactions = FilterTransactions(transactions);
            foreach (var filteredTransaction in filteredTransactions)
                ApplyInternal(filteredTransaction);
        }

        private void ApplyInternal(Transaction filteredTransaction)
        {
            filteredTransaction.ApplyEdit(this);
        }

        private IEnumerable<string> GetContent()
        {
            return this.Scope.ToString().AsEnumerable()
                .Concat(this.ScopeParameters.EmptyIfNull())
                .Concat(this.UserCorrection.IfNotNull(u => u.GetContent()).EmptyIfNull())
                .Concat(this.CategoryPath.EmptyIfNull());
        }

        private IEnumerable<Transaction> FilterTransactions(Transactions transactions)
        {
            return transactions.Where(FilterTransaction);
        }

        private bool FilterTransaction(Transaction transaction)
        {
            switch (this.Scope)
            {
                case TransactionEditScope.All:
                    return true;
                case TransactionEditScope.None:
                    return false;
                case TransactionEditScope.EntityName:
                    return string.Equals(transaction.EntityName, this.ScopeParameters[0], StringComparison.CurrentCultureIgnoreCase);
                case TransactionEditScope.EntityNameNormalized:
                    return string.Equals(transaction.EntityNameNormalized, this.ScopeParameters[0], StringComparison.CurrentCultureIgnoreCase);
                case TransactionEditScope.TransactionID:
                    return string.Equals(transaction.Id, this.ScopeParameters[0], StringComparison.Ordinal);
                default:
                    throw new NotSupportedException("TransactionEdit.Scope value of {0} is not supported".FormatEx(this.Scope.ToString()));
            }
        }

        public string SerializeToJson()
        {
            return JsonSerializer<TransactionEdit>.Serialize(this);
        }
        public static TransactionEdit DeserializeFromJson(string serializedData)
        {
            return JsonSerializer<TransactionEdit>.Deserialize(serializedData);
        }
    }
}
