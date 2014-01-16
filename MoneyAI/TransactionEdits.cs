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
    public class TransactionEdits : IEnumerable<TransactionEdit>, IDeserializationCallback
    {
        [DataMember]
        private readonly LinkedList<TransactionEdit> edits;

        private Dictionary<string, TransactionEdit> editsById;

        [DataMember(Name = "sourceId")]
        public string SourceId { get; private set; }

        public TransactionEdits(string sourceId)
        {
            this.edits = new LinkedList<TransactionEdit>();
            this.SourceId = sourceId;
            this.editsById = new Dictionary<string, TransactionEdit>();
        }

        internal void Add(TransactionEdit edit)
        {
            this.edits.AddLast(edit);
            this.editsById.Add(edit.Id, edit);
        }

        public TransactionEdit this[string id]
        {
            get { return this.editsById[id]; }
        }

        public int Count { get { return this.edits.Count; } }

        private TransactionEdit AddEditForScope(IEnumerable<TransactionEdit.ScopeFilter> scopeFilters)
        {
            var edit = new TransactionEdit(scopeFilters, this.SourceId);
            this.Add(edit);

            return edit;
        }

        public TransactionEdit CreateEditIsUserFlagged(IEnumerable<string> trasactionIds, bool? isUserFlagged)
        {
            var scopeFilter = new TransactionEdit.ScopeFilter(TransactionEdit.ScopeType.TransactionId, trasactionIds.ToArray());
            var edit = AddEditForScope(scopeFilter.AsEnumerable());

            edit.Values.IsFlagged = isUserFlagged.HasValue ? new Transaction.EditValue<bool>(isUserFlagged.Value) : Transaction.EditValue<bool>.VoidedEditValue;

            return edit;
        }

        public TransactionEdit CreateEditCategory(IEnumerable<TransactionEdit.ScopeFilter> scopeFilters, string[] categoryPath)
        {
            var edit = AddEditForScope(scopeFilters);

            edit.Values.CategoryPath = categoryPath != null ? new Transaction.EditValue<string[]>(categoryPath) : Transaction.EditValue<string[]>.VoidedEditValue;

            return edit;
        }

        public TransactionEdit CreateEditNote(IEnumerable<string> trasactionIds, string note)
        {
            var scopeFilter = new TransactionEdit.ScopeFilter(TransactionEdit.ScopeType.TransactionId, trasactionIds.ToArray());
            var edit = AddEditForScope(scopeFilter.AsEnumerable());

            edit.Values.Note = note != null ? new Transaction.EditValue<string>(note) : Transaction.EditValue<string>.VoidedEditValue;

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

        internal void Merge(TransactionEdits other)
        {
            foreach (var otherEdit in other)
                AddEditClone(otherEdit);
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


        public void OnDeserialization(object sender)
        {
            this.editsById = this.edits.ToDictionary(e => e.Id, e => e);
        }

        public TransactionEdits Clone()
        {
            var serializedData = this.SerializeToJson();
            return TransactionEdits.DeserializeFromJson(serializedData);
        }
    }
}
