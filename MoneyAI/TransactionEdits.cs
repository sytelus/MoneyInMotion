using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI
{
    public class TransactionEdits
    {
        private readonly IDictionary<string, TransactionEdit> editsLookup;
        private readonly IList<TransactionEdit> editsList;

        public string SourceId { get; private set; }

        public TransactionEdits(string sourceId) : this(Enumerable.Empty<TransactionEdit>(), sourceId)
        {
        }

        public TransactionEdits(IEnumerable<TransactionEdit> edits, string sourceId)
        {
            this.editsList = new List<TransactionEdit>(edits);
            this.editsLookup = this.editsList.ToDictionary(e => e.Scope.Id, e => e);
            this.SourceId = sourceId;
        }

        public TransactionEdit UpdateEntityNameNormalizedCategoryAssignment(string entityNameNormalized, string[] categoryPath)
        {
            const TransactionEdit.ScopeType scopeType = TransactionEdit.ScopeType.EntityNameNormalized;
            var scopeParameters = new[] {entityNameNormalized};

            var edit = GetOrCreateEditForScope(new TransactionEdit.EditScope(scopeType, scopeParameters));

            edit.Values.CategoryPath = categoryPath != null ? new Transaction.EditValue<string[]>(categoryPath) 
                : Transaction.EditValue<string[]>.VoidedEditValue;

            return edit;
        }

        private void Add(TransactionEdit edit)
        {
            this.editsLookup.Add(edit.Scope.Id, edit);
            this.editsList.Add(edit);
        }

        public TransactionEdit UpdateIsUserFlagged(string trasactionId, bool? isUserFlagged)
        {
            const TransactionEdit.ScopeType scopeType = TransactionEdit.ScopeType.TransactionId;
            var scopeParameters = new[] { trasactionId };

            var edit = GetOrCreateEditForScope(new TransactionEdit.EditScope(scopeType, scopeParameters));

            edit.Values.IsFlagged = isUserFlagged.HasValue ? new Transaction.EditValue<bool>(isUserFlagged.Value) : Transaction.EditValue<bool>.VoidedEditValue;

            return edit;
        }

        private TransactionEdit GetOrCreateEditForScope(TransactionEdit.EditScope scope)
        {
            var existing = this.editsLookup.GetValueOrDefault(scope.Id);
            if (existing == null)
            {
                existing = new TransactionEdit(scope, this.SourceId);
                this.editsLookup.Add(scope.Id, existing);
                this.editsList.Add(existing);
            }

            return existing;
        }

        public void Apply(Transactions transactions)
        {
            foreach (var edit in this.editsList)
                edit.Apply(transactions);
        }

        public IEnumerable<string> SerializeToJson()
        {
            return this.editsLookup.Values.Select(JsonSerializer<TransactionEdit>.Serialize);
        }
        public static TransactionEdits DeserializeFromJson(IEnumerable<string> serializedData, string sourceId)
        {
            var deserializedEdits = serializedData.Select(JsonSerializer<TransactionEdit>.Deserialize);

            var transactionEdits = new TransactionEdits(deserializedEdits, sourceId);

            return transactionEdits;
        }
    }
}
