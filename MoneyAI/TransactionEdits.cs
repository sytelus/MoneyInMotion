using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI
{
    [DataContract]
    public class TransactionEdits : IEnumerable<TransactionEdit>
    {
        [DataMember]
        private readonly LinkedList<TransactionEdit> edits;

        [DataMember]
        public string SourceId { get; private set; }

        public TransactionEdits(string sourceId)
        {
            this.edits = new LinkedList<TransactionEdit>();
            this.SourceId = sourceId;
        }

        private void Add(TransactionEdit edit)
        {
            this.edits.AddLast(edit);
        }

        private TransactionEdit AddEditForScope(TransactionEdit.ScopeType scopeType, string[] scopeParameters)
        {
            var scope = new TransactionEdit.EditScope(scopeType, scopeParameters);
            var edit = new TransactionEdit(scope, this.SourceId);
            this.Add(edit);

            return edit;
        }

        public TransactionEdit UpdateIsUserFlagged(string trasactionId, bool? isUserFlagged)
        {
            var edit = AddEditForScope(TransactionEdit.ScopeType.TransactionId, new[] { trasactionId });

            edit.Values.IsFlagged = isUserFlagged.HasValue ? new Transaction.EditValue<bool>(isUserFlagged.Value) : Transaction.EditValue<bool>.VoidedEditValue;

            return edit;
        }

        public TransactionEdit UpdateEntityNameNormalizedCategoryAssignment(string entityNameNormalized, string[] categoryPath)
        {
            var edit = AddEditForScope(TransactionEdit.ScopeType.EntityNameNormalized, new[] { entityNameNormalized });

            edit.Values.CategoryPath = categoryPath != null ? new Transaction.EditValue<string[]>(categoryPath) : Transaction.EditValue<string[]>.VoidedEditValue;

            return edit;
        }

        private void AddEditClone(TransactionEdit other)
        {
            var edit = new TransactionEdit(other);
            this.Add(edit);
        }

        public string SerializeToJson()
        {
            return JsonSerializer<TransactionEdits>.Serialize(this);
        }
        public static TransactionEdits DeserializeFromJson(string serializedData)
        {
            var transactionEdits = JsonSerializer<TransactionEdits>.Deserialize(serializedData);
            return transactionEdits;
        }

        internal void Merge(TransactionEdits other, ICollection<string> knownTransactionIds)
        {
            foreach (var otherEdit in other
                .Where(otherEdit => otherEdit.Scope.Type != TransactionEdit.ScopeType.TransactionId 
                                    || knownTransactionIds.Contains(otherEdit.Scope.Parameters[0])))
            {
                AddEditClone(otherEdit);
            }
        }

        #region IEnumerable
        public IEnumerator<TransactionEdit> GetEnumerator()
        {
            return this.edits.GetEnumerator();
        }

        System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator()
        {
            return this.edits.GetEnumerator();
        }
        #endregion

    }
}
