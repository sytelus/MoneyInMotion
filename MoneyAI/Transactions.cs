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
        public string Name { get; private set; }
        
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
        {
            this.Name = name;
            this.items = new List<Transaction>();
            this.uniqueContentHashes = new HashSet<string>();

            this.accountInfos = new Dictionary<string, AccountInfo>();
            this.importInfos = new Dictionary<string, ImportInfo>();

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
        public bool HasAccountInfo(string accountId)
        {
            return this.accountInfos.ContainsKey(accountId);
        }
        public bool HasContentHash(string contentHash)
        {
            return this.uniqueContentHashes.Contains(contentHash);
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
                .Select(t => t.Clone()).ToList();

            this.items.AddRange(newItems);
            this.uniqueContentHashes.AddRange(newItems.Select(i => i.ContentHash));
            this.accountInfos.AddRange(newItems.Select(i => i.AccountId).Where(aid => !this.accountInfos.ContainsKey(aid)).Select(aid =>
                new KeyValuePair<string, AccountInfo>(aid, other.GetAccountInfo(aid))));
            this.importInfos.AddRange(newItems.Select(i => i.ImportId).Where(iid => !this.importInfos.ContainsKey(iid)).Select(iid =>
                new KeyValuePair<string, ImportInfo>(iid, other.GetImportInfo(iid))));
            this.edits.Merge(other.edits, this.uniqueContentHashes);
        }

        private bool AddNew(Transaction transaction, bool allowDuplicate, AccountInfo accountInfo, ImportInfo importInfo)
        {
            if (allowDuplicate || !uniqueContentHashes.Contains(transaction.ContentHash))
            {
                this.items.Add(transaction);
                this.uniqueContentHashes.Add(transaction.ContentHash);
                this.accountInfos.AddIfNotExist(accountInfo.Id, accountInfo);
                this.importInfos.AddIfNotExist(importInfo.Id, importInfo);
                return true;
            }
            else return false;
        }

        public Transaction AddFromCsvLine(string[] headerColumns, string line, int lineNumber, AccountInfo accountInfo, ImportInfo importInfo, bool allowDuplicate = true)
        {
            var transaction = Transaction.CreateFromCsvLine(headerColumns, line, accountInfo.Id, importInfo.Id, lineNumber);
            this.AddNew(transaction, allowDuplicate, accountInfo, importInfo);

            return transaction;
        }


        #region ICollection 

        public IEnumerator<Transaction> GetEnumerator()
        {
            return items.GetEnumerator();
        }

        IEnumerator IEnumerable.GetEnumerator()
        {
            return items.GetEnumerator();
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
        #endregion

        #region Apply Edit
        private IEnumerable<Transaction> FilterTransactions(TransactionEdit edit)
        {
            return this.items.Where(t => FilterTransaction(edit, t));
        }

        private static bool FilterTransaction(TransactionEdit edit, Transaction transaction)
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
