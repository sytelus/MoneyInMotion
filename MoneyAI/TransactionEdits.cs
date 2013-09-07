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
        private readonly IDictionary<string, TransactionEdit> edits;

        public TransactionEdits()
        {
            this.edits = new Dictionary<string, TransactionEdit>();
        }

        public TransactionEdit UpdateEntityNameNormalizedCategoryAssignment(string entityNameNormalized, string[] categoryPath)
        {
            const TransactionEditScope scope = TransactionEditScope.EntityNameNormalized;
            var scopeParameters = new[] {entityNameNormalized};

            var edit = GetOrCreateEditForScope(scope, scopeParameters);

            if (categoryPath != null)
            {
                edit.EditedValues.CategoryPath = new Transaction.EditValue<string[]>(categoryPath);
            }
            else
                edit.EditedValues.CategoryPath = Transaction.EditValue<string[]>.VoidedEditValue;

            return edit;
        }

        public TransactionEdit UpdateIsUserFlagged(string trasactionId, bool? isUserFlagged)
        {
            const TransactionEditScope scope = TransactionEditScope.TransactionID;
            var scopeParameters = new[] { trasactionId };

            var edit = GetOrCreateEditForScope(scope, scopeParameters);

            if (isUserFlagged.HasValue)
                edit.EditedValues.IsFlagged = new Transaction.EditValue<bool>(isUserFlagged.Value);
            else
                edit.EditedValues.IsFlagged = Transaction.EditValue<bool>.VoidedEditValue;

            return edit;
        }

        private TransactionEdit GetOrCreateEditForScope(TransactionEditScope scope, string[] scopeParameters)
        {
            var scopeHash = TransactionEdit.GetScopeHash(scope, scopeParameters);
            return this.edits.GetValueOrDefault(scopeHash) ?? new TransactionEdit(scope, scopeParameters);
        }

        public void Apply(Transactions transactions)
        {
            foreach (var edit in this.edits.Values)
                edit.Apply(transactions);
        }

        public IEnumerable<string> SerializeToJson()
        {
            return this.edits.Values.Select(JsonSerializer<TransactionEdit>.Serialize);
        }
        public static TransactionEdits DeserializeFromJson(IEnumerable<string> serializedData)
        {
            var transactionEdits = new TransactionEdits();
            transactionEdits.edits.AddRange(serializedData
                .Select(line =>
                        {
                            var edit = JsonSerializer<TransactionEdit>.Deserialize(line);
                            return new KeyValuePair<string, TransactionEdit>(edit.ScopeHash, edit);
                        }));

            return transactionEdits;
        }
    }
}
