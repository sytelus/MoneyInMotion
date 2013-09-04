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
    public class TransactionEdits : ListSet<string, TransactionEdit>
    {
        public TransactionEdits() : base(GetContentHash)
        {
            
        }

        private static string GetContentHash(TransactionEdit edit)
        {
            return edit.ContentHash;
        }

        public void Apply(Transactions transactions)
        {
            foreach (var edit in this)
                edit.Apply(transactions);
        }

        public IEnumerable<string> SerializeToJson()
        {
            return this.Select(JsonSerializer<TransactionEdit>.Serialize);
        }
        public static TransactionEdits DeserializeFromJson(IEnumerable<string> serializedData)
        {
            var edits = new TransactionEdits();
            edits.AddRange(serializedData.Select(JsonSerializer<TransactionEdit>.Deserialize));
            return edits;
        }
    }
}
