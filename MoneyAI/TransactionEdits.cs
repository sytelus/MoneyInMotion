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
        private readonly LinkedList<TransactionEdit> editsList;

        [DataMember]
        public string SourceId { get; private set; }

        private Dictionary<string, TransactionEdit> lastEditByScope;

        public TransactionEdits(string sourceId)
        {
            this.editsList = new LinkedList<TransactionEdit>();
            this.SourceId = sourceId;

            this.Initialize();
        }

        public TransactionEdit UpdateEntityNameNormalizedCategoryAssignment(string entityNameNormalized, string[] categoryPath, bool updateLastEditByScope = false)
        {
            var edit = GetOrCreateEditForScope(TransactionEdit.ScopeType.EntityNameNormalized, new[] { entityNameNormalized }, updateLastEditByScope);

            edit.Values.CategoryPath = categoryPath != null ? new Transaction.EditValue<string[]>(categoryPath) 
                : Transaction.EditValue<string[]>.VoidedEditValue;

            return edit;
        }

        private void Add(TransactionEdit edit)
        {
            this.lastEditByScope[edit.Scope.Id] = edit;
            this.editsList.AddLast(edit);
        }

        public TransactionEdit UpdateIsUserFlagged(string trasactionId, bool? isUserFlagged, bool updateLastEditByScope = false)
        {
            var edit = GetOrCreateEditForScope(TransactionEdit.ScopeType.TransactionId, new[] { trasactionId }, updateLastEditByScope);

            edit.Values.IsFlagged = isUserFlagged.HasValue ? new Transaction.EditValue<bool>(isUserFlagged.Value) : Transaction.EditValue<bool>.VoidedEditValue;

            return edit;
        }


        private void CopyFromEdit(TransactionEdit other, bool updateLastEditByScope)
        {
            var existing = updateLastEditByScope ? this.lastEditByScope.GetValueOrDefault(other.Scope.Id) : null;
            if (existing == null)
            {
                existing = new TransactionEdit(other);
                this.Add(existing);
            }
            else existing.Merge(other);
        }


        private TransactionEdit GetOrCreateEditForScope(TransactionEdit.ScopeType scopeType, string[] scopeParameters, bool updateLastEditByScope)
        {
            var scope = new TransactionEdit.EditScope(scopeType, scopeParameters);

            var existing = updateLastEditByScope ? this.lastEditByScope.GetValueOrDefault(scope.Id) : null;
            if (existing == null)
            {
                existing = new TransactionEdit(scope, this.SourceId);
                this.Add(existing);
            }

            return existing;
        }

        public string SerializeToJson()
        {
            return JsonSerializer<TransactionEdits>.Serialize(this);
        }
        public static TransactionEdits DeserializeFromJson(string serializedData)
        {
            var transactionEdits = JsonSerializer<TransactionEdits>.Deserialize(serializedData);
            transactionEdits.Initialize();
            return transactionEdits;
        }

        private void Initialize()
        {
            this.lastEditByScope = this.editsList.ToLastSetDictionary(e => e.Scope.Id, e => e);
        }

        public void Merge(TransactionEdits other, ICollection<string> knownTransactionIds, bool updateLastEditByScope = false)
        {
            foreach (var otherEdit in other
                .Where(otherEdit => otherEdit.Scope.Type != TransactionEdit.ScopeType.TransactionId 
                                    || knownTransactionIds.Contains(otherEdit.Scope.Parameters[0])))
            {
                CopyFromEdit(otherEdit, updateLastEditByScope);
            }
        }

        public IEnumerator<TransactionEdit> GetEnumerator()
        {
            return this.editsList.GetEnumerator();
        }

        System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator()
        {
            return this.editsList.GetEnumerator();
        }
    }
}
