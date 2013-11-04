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
    /// <summary>
    /// This class should be immutable outside of library.
    /// </summary>
    [DataContract]
    public partial class TransactionEdit
    {
        [DataMember(IsRequired = true, Name = "auditInfo")]
        public AuditInfo AuditInfo { get; private set; }

        [DataMember(IsRequired = true, Name = "scope")]
        public EditScope Scope { get; private set; }

        [DataMember(EmitDefaultValue = false, Name = "values")]
        public EditedValues Values { get; private set; }

        [DataMember(IsRequired = true, Name = "sourceId")]
        public string SourceId { get; private set; }

        [DataMember(IsRequired = true, Name = "id")]
        public string Id { get; private set; }

        internal TransactionEdit(EditScope scope, string sourceId, EditedValues editValues = null)
        {
            this.AuditInfo = new AuditInfo();
            this.Scope = scope;
            this.SourceId = sourceId;
            this.Values = new EditedValues(editValues);
            this.Id = Guid.NewGuid().ToBase64String();
        }

        internal TransactionEdit(TransactionEdit edit): this(edit.Scope, edit.SourceId, edit.Values)
        {
        }

        internal void Merge(TransactionEdit otherEdit)
        {
            this.Values.Merge(otherEdit.Values);
            this.AuditInfo = new AuditInfo(this.AuditInfo, true);
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
