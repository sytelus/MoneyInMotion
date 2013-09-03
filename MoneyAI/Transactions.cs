using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using CommonUtils;

namespace MoneyAI
{
    public class Transactions : ICollection<Transaction>
    {
        private readonly IList<Transaction> items = new List<Transaction>();
        private readonly HashSet<string> uniqueIds = new HashSet<string>();
        private readonly IDictionary<string, AccountInfo> accountInfos = new Dictionary<string, AccountInfo>();
        private readonly IDictionary<string, ImportInfo> importInfos = new Dictionary<string, ImportInfo>();

        public Transactions() : this(null, null, null)
        {
            
        }

        public Transactions(ICollection<Transaction> others, IEnumerable<AccountInfo> accountInfos, IEnumerable<ImportInfo> importInfos)
        {
            if (others != null)
                this.Merge(others, accountInfos, importInfos);
        }

        //FUTURE: Should be readonly dictionary
        public IDictionary<string, AccountInfo> AccountInfos
        {
            get { return this.accountInfos; } 
        }
        //FUTURE: Should be readonly dictionary
        public IDictionary<string, ImportInfo> ImportInfos
        {
            get { return this.importInfos; }
        }

        public class  SerializedComponents 
        {
            public IEnumerable<string> SerializedTransactions { get; set; }
            public IEnumerable<string> SerializedAccountInfos { get; set; }
            public IEnumerable<string> SerializedImportInfos { get; set; }
        }

        public SerializedComponents SerializeToJson()
        {
            var components = new SerializedComponents()
            {
                SerializedTransactions = this.items.Select(item => item.SerializeToJson()),
                SerializedAccountInfos = this.accountInfos.Values.Select(a => a.SerializeToJson()),
                SerializedImportInfos = this.importInfos.Values.Select(i => i.SerializeToJson())
            };
            return components;
        }

        public static Transactions DeserializeFromJson(SerializedComponents serializedComponents)
        {
            var transactionList = serializedComponents.SerializedTransactions.Select(Transaction.DeserializeFromJson).ToList();
            var accountInfosDeserialized = serializedComponents.SerializedAccountInfos.Select(AccountInfo.DeserializeFromJson);
            var importInfosDeserialized = serializedComponents.SerializedImportInfos.Select(ImportInfo.DeserializeFromJson);
            return new Transactions(transactionList, accountInfosDeserialized, importInfosDeserialized);
        }

        public void Merge(ICollection<Transaction> others, IEnumerable<AccountInfo> otherAccountInfos, IEnumerable<ImportInfo> otherImportInfos)
        {
            //First add transaction without updating IDs. THEN add IDs.
            this.items.AddRange(others.Where(i => !this.uniqueIds.Contains(i.ContentHash)));
            this.uniqueIds.AddRange(others.Select(i => i.ContentHash));
            this.accountInfos.AddRange(otherAccountInfos
                .Where(a => !this.accountInfos.ContainsKey(a.Id))
                .Select(a => new KeyValuePair<string, AccountInfo>(a.Id, a)), false);
            this.importInfos.AddRange(otherImportInfos
                .Where(i => !this.importInfos.ContainsKey(i.Id))
                .Select(i => new KeyValuePair<string, ImportInfo>(i.Id, i)), false);
        }

        public void Merge(Transactions other)
        {
            this.Merge(other.items, other.AccountInfos.Values, other.ImportInfos.Values);
        }

        public IEnumerator<Transaction> GetEnumerator()
        {
            return items.GetEnumerator();
        }

        IEnumerator IEnumerable.GetEnumerator()
        {
            return items.GetEnumerator();
        }

        public bool Add(Transaction item, bool allowDuplicate, AccountInfo accountInfo, ImportInfo importInfo)
        {
            if (allowDuplicate || !uniqueIds.Contains(item.ContentHash))
            {
                this.items.Add(item);
                this.uniqueIds.Add(item.ContentHash);
                this.accountInfos.AddIfNotExist(accountInfo.Id, accountInfo);
                this.importInfos.AddIfNotExist(importInfo.Id, importInfo);
                return true;
            }
            else return false;
        }

        public void Clear()
        {
            this.items.Clear();
            this.uniqueIds.Clear();
            this.accountInfos.Clear();
            this.importInfos.Clear();
        }

        public bool Contains(Transaction item)
        {
            throw new NotImplementedException();
        }

        public void CopyTo(Transaction[] array, int arrayIndex)
        {
            items.CopyTo(array, arrayIndex);
        }

        public int Count
        {
            get { return items.Count; }
        }

        public bool IsReadOnly
        {
            get { return items.IsReadOnly; }
        }

        public bool Remove(Transaction item)
        {
            throw new NotSupportedException();
        }

        public void Add(Transaction item)
        {
            throw new NotImplementedException();
        }
    }
}
