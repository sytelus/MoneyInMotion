using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using CommonUtils;

namespace MoneyAI
{
    [DataContract]
    public class Transactions : ICollection<Transaction>
    {

        [DataMember]
        private readonly string name;
        
        [DataMember]
        private readonly List<Transaction> items;

        [DataMember]
        private readonly HashSet<string> uniqueContentHashes;

        [DataMember]
        private readonly Dictionary<string, AccountInfo> accountInfos;

        [DataMember]
        private readonly Dictionary<string, ImportInfo> importInfos;

        [DataMember]
        private readonly TransactionEdits edits;


        public Transactions(string name)
            : this(name, null, null, null)
        {
            
        }

        public Transactions(string name, IEnumerable<Transaction> importedTransactions, AccountInfo importedAccountInfo, ImportInfo importInfo) 
        {
            this.name = name;
            this.items = importedTransactions == null ? new List<Transaction>() : importedTransactions.ToList();
            this.uniqueContentHashes = this.items.Select(t => t.ContentHash).ToHashSet();

            this.accountInfos = new Dictionary<string, AccountInfo>();
            if (importedAccountInfo != null)
                accountInfos.Add(importedAccountInfo.Id, importedAccountInfo);

            this.importInfos = new Dictionary<string, ImportInfo>();
            if (importInfo != null)
                this.importInfos.Add(importInfo.Id, importInfo);

            this.edits = new TransactionEdits(name);
        }

        public AccountInfo GetAccountInfo(string accountId)
        {
            return this.accountInfos[accountId]; 
        }
        
        public ImportInfo GetImportInfo(string importId)
        {
            return this.importInfos[importId]; 
        }

        public bool HasImportInfo(string importId)
        {
            return this.importInfos.ContainsKey(importId);
        }

        public string SerializeToJson()
        {
            return JsonSerializer<Transactions>.Serialize(this);
        }

        public static Transactions DeserializeFromJson(string serializedData)
        {
            return JsonSerializer<Transactions>.Deserialize(serializedData);
        }

        public void Merge(Transactions other)
        {
            var newItems = other
                .Where(t => !this.uniqueContentHashes.Contains(t.ContentHash))
                .Select(t => t.CreateCopy()).ToList();

            this.items.AddRange(newItems);
            this.uniqueContentHashes.AddRange(newItems.Select(i => i.ContentHash));
            this.accountInfos.AddRange(newItems.Select(i => i.AccountId).Where(aid => !this.accountInfos.ContainsKey(aid)).Select(aid =>
                new KeyValuePair<string, AccountInfo>(aid, other.GetAccountInfo(aid))));
            this.importInfos.AddRange(newItems.Select(i => i.ImportId).Where(iid => !this.importInfos.ContainsKey(iid)).Select(iid =>
                new KeyValuePair<string, ImportInfo>(iid, other.GetImportInfo(iid))));
            this.edits.Merge(other.edits, this.uniqueContentHashes);

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
            if (allowDuplicate || !uniqueContentHashes.Contains(item.ContentHash))
            {
                this.items.Add(item);
                this.uniqueContentHashes.Add(item.ContentHash);
                this.accountInfos.AddIfNotExist(accountInfo.Id, accountInfo);
                this.importInfos.AddIfNotExist(importInfo.Id, importInfo);
                return true;
            }
            else return false;
        }

        public void Clear()
        {
            this.items.Clear();
            this.uniqueContentHashes.Clear();
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
            get { return false; }
        }

        public bool Remove(Transaction item)
        {
            throw new NotSupportedException();
        }

        public void Add(Transaction item)
        {
            throw new NotImplementedException();
        }

        #region Edit application code
        private IEnumerable<Transaction> FilterTransactions(TransactionEdit edit)
        {
            return this.items.Where(t => FilterTransaction(edit, t));
        }

        private bool FilterTransaction(TransactionEdit edit, Transaction transaction)
        {
            switch (edit.Scope.Type)
            {
                case TransactionEdit.ScopeType.All:
                    return true;
                case TransactionEdit.ScopeType.None:
                    return false;
                case TransactionEdit.ScopeType.EntityName:
                    return string.Equals(transaction.EntityName, edit.Scope.Parameters[0], StringComparison.CurrentCultureIgnoreCase);
                case TransactionEdit.ScopeType.EntityNameNormalized:
                    return string.Equals(transaction.EntityNameNormalized, edit.Scope.Parameters[0], StringComparison.CurrentCultureIgnoreCase);
                case TransactionEdit.ScopeType.TransactionId:
                    return string.Equals(transaction.Id, edit.Scope.Parameters[0], StringComparison.Ordinal);
                default:
                    throw new NotSupportedException("TransactionEdit.Scope value of {0} is not supported".FormatEx(edit.Scope.Type.ToString()));
            }
        }

        public int Apply(TransactionEdit edit)
        {
            var filteredTransactions = this.FilterTransactions(edit);
            var count = 0;
            foreach (var filteredTransaction in filteredTransactions)
            {
                filteredTransaction.ApplyEdit(edit);
                count++;
            }
            return count;
        }

        #endregion
    }
}
