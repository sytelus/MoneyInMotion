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
    [DataContract]
    public partial class TransactionEdit
    {
        [DataMember(IsRequired = true)]
        public AuditInfo AuditInfo { get; private set; }

        [DataMember(IsRequired = true)]
        public EditScope Scope { get; private set; }

        [DataMember(EmitDefaultValue = false)]
        public EditedValues Values { get; private set; }

        [DataMember(IsRequired = true)]
        public string SourceId { get; private set; }

        internal TransactionEdit(EditScope scope, string sourceId)
        {
            this.AuditInfo = AuditInfo.Create();
            this.Scope = scope;
            this.SourceId = sourceId;
        }

        private IEnumerable<Transaction> FilterTransactions(IEnumerable<Transaction> transactions)
        {
            return transactions.Where(FilterTransaction);
        }

        private bool FilterTransaction(Transaction transaction)
        {
            switch (this.Scope.Type)
            {
                case ScopeType.All:
                    return true;
                case ScopeType.None:
                    return false;
                case ScopeType.EntityName:
                    return string.Equals(transaction.EntityName, this.Scope.ScopeParameters[0], StringComparison.CurrentCultureIgnoreCase);
                case ScopeType.EntityNameNormalized:
                    return string.Equals(transaction.EntityNameNormalized, this.Scope.ScopeParameters[0], StringComparison.CurrentCultureIgnoreCase);
                case ScopeType.TransactionId:
                    return string.Equals(transaction.Id, this.Scope.ScopeParameters[0], StringComparison.Ordinal);
                default:
                    throw new NotSupportedException("TransactionEdit.Scope value of {0} is not supported".FormatEx(this.Scope.Type.ToString()));
            }
        }

        public void Apply(IEnumerable<Transaction> transactions)
        {
            var filteredTransactions = this.FilterTransactions(transactions);
            foreach (var filteredTransaction in filteredTransactions)
                filteredTransaction.ApplyEdit(this);
        }

        internal void Merge(TransactionEdit otherEdit)
        {
            this.Values.Merge(otherEdit.Values);
            AuditInfo.Update();
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
