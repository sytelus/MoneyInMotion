using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Runtime.Serialization;
using System.Text;
using CommonUtils;

namespace MoneyAI
{
    [DataContract]
    public class Transactions : ICollection<Transaction>, IDeserializationCallback 
    {

        [DataMember(Name = "name")]
        public string Name { get; private set; }
        
        [DataMember]
        private readonly List<Transaction> items;

        private HashSet<string> uniqueContentHashes;
        private Dictionary<string, Transaction> itemsById;

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
            this.itemsById = new Dictionary<string, Transaction>();

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

        public Transaction this[string id]
        {
            get { return this.itemsById[id]; }
        }

        public IEnumerable<TransactionEdit> GetEditsDescending(Transaction transaction)
        {
            if (transaction.AppliedEditIdsDescending == null)
                return Enumerable.Empty<TransactionEdit>();
            else
                return transaction.AppliedEditIdsDescending.Select(editId => this.edits[editId]);
        }

        public IEnumerable<Transaction> SetIsUserFlagged(IEnumerable<Transaction> transactions, bool isUserFlagged)
        {
            var edit = this.edits.CreateEditIsUserFlagged(transactions.Select(t => t.Id), isUserFlagged);
            return this.ApplyInternal(edit);
        }

        public IEnumerable<Transaction> SetCategory(IEnumerable<TransactionEdit.ScopeFilter> scopeFilters, string[] categoryPath)
        {
            var edit = this.edits.CreateEditCategory(scopeFilters, categoryPath);
            return this.ApplyInternal(edit);
        }

        public IEnumerable<Transaction> SetNote(IEnumerable<Transaction> transactions, string note)
        {
            var edit = this.edits.CreateEditNote(transactions.Select(t => t.Id), note);
            return this.ApplyInternal(edit);
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

            this.itemsById.AddRange(newItems.Select(i => new KeyValuePair<string, Transaction>(i.Id, i)));
            this.items.AddRange(newItems);
            this.uniqueContentHashes.AddRange(newItems.Select(i => i.ContentHash));
            this.accountInfos.AddRange(newItems.Select(i => i.AccountId).Where(aid => !this.accountInfos.ContainsKey(aid)).Select(aid =>
                new KeyValuePair<string, AccountInfo>(aid, other.GetAccountInfo(aid))));
            this.importInfos.AddRange(newItems.Select(i => i.ImportId).Where(iid => !this.importInfos.ContainsKey(iid)).Select(iid =>
                new KeyValuePair<string, ImportInfo>(iid, other.GetImportInfo(iid))));
            this.edits.Merge(other.edits, this.uniqueContentHashes);
        }

        /// <param name="allowDuplicate">Should be true when importing transactions from a file but false when merging items from two files</param>
        public bool AddNew(Transaction transaction, AccountInfo accountInfo, ImportInfo importInfo, bool allowDuplicate)
        {
            if (allowDuplicate || !uniqueContentHashes.Contains(transaction.ContentHash))
            {
                this.itemsById.Add(transaction.Id, transaction);
                this.items.Add(transaction);
                this.uniqueContentHashes.Add(transaction.ContentHash);
                this.accountInfos.AddIfNotExist(accountInfo.Id, accountInfo);
                this.importInfos.AddIfNotExist(importInfo.Id, importInfo);
                return true;
            }
            else return false;
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
            this.itemsById.Clear();
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
            var filteredTransactions = this.items;
            foreach (var scopeFilter in edit.ScopeFilters)
                filteredTransactions = filteredTransactions.Where(t => FilterTransaction(scopeFilter, t)).ToList();

            return filteredTransactions;
        }

        private static bool FilterTransaction(TransactionEdit.ScopeFilter scopeFilter, Transaction transaction)
        {
            //TODO: remove re-prasing
            switch (scopeFilter.Type)
            {
                case TransactionEdit.ScopeType.All:
                    return true;
                case TransactionEdit.ScopeType.None:
                    return false;
                case TransactionEdit.ScopeType.EntityName:
                    return scopeFilter.Parameters.Any(p => string.Equals(transaction.EntityName, p, StringComparison.CurrentCultureIgnoreCase));
                case TransactionEdit.ScopeType.EntityNameNormalized:
                    return scopeFilter.Parameters.Any(p => string.Equals(transaction.EntityNameNormalized, p, StringComparison.CurrentCultureIgnoreCase));
                case TransactionEdit.ScopeType.TransactionId:
                    return scopeFilter.Parameters.Any(p => string.Equals(transaction.Id, p, StringComparison.Ordinal));
                case TransactionEdit.ScopeType.EntityNameAnyTokens:
                    return scopeFilter.Parameters.Any(p => transaction.EntityNameTokens.Any(t => string.Equals(t, p, StringComparison.CurrentCultureIgnoreCase)));
                case TransactionEdit.ScopeType.EntityNameAllTokens:
                    return scopeFilter.Parameters.All(p => transaction.EntityNameTokens.Any(t => string.Equals(t, p, StringComparison.CurrentCultureIgnoreCase)));
                case TransactionEdit.ScopeType.AccountId:
                    return scopeFilter.Parameters.Any(p => string.Equals(transaction.AccountId, p, StringComparison.Ordinal));
                case TransactionEdit.ScopeType.TransactionReason:
                    return scopeFilter.Parameters.Any(p => (TransactionReason)Enum.Parse(typeof(TransactionReason), p) == transaction.TransactionReason);
                case TransactionEdit.ScopeType.AmountRange:
                    return transaction.Amount >= Decimal.Parse(scopeFilter.Parameters[0]) && transaction.Amount <= Decimal.Parse(scopeFilter.Parameters[1]);
                default:
                    throw new NotSupportedException("TransactionEdit.Scope value of {0} is not supported in FilterTransaction".FormatEx(scopeFilter.Type.ToString()));
            }
        }

        public IEnumerable<Transaction> Apply(TransactionEdit edit, bool ignoreMissingIds = true)
        {
            this.edits.Add(edit);

            // ReSharper disable once IteratorMethodResultIsIgnored
            return this.ApplyInternal(edit, ignoreMissingIds);
        }

        public void Apply(TransactionEdits editsToApply, bool ignoreMissingIds = true)
        {
            foreach (var edit in editsToApply)
            {
                this.Apply(edit, ignoreMissingIds);
            }
        }

        /// <summary>
        /// Assumes edit has already been added in this.edits collection
        /// </summary>
        private IEnumerable<Transaction> ApplyInternal(TransactionEdit edit, bool ignoreMissingIds = false)
        {
            var filteredTransactions = this.FilterTransactions(edit);
            var count = 0;
            foreach (var filteredTransaction in filteredTransactions)
            {
                filteredTransaction.ApplyEdit(edit);
                yield return filteredTransaction;
                count++;
            }

            if (!ignoreMissingIds && edit.ScopeFilters.Length == 1 && edit.ScopeFilters[0].Type == TransactionEdit.ScopeType.TransactionId && count != edit.ScopeFilters[0].Parameters.Length)
                throw new Exception("Edit targetted transactions with {0} IDs but only {1} were found in this collection".FormatEx(edit.ScopeFilters[0].Parameters.Length, count));
        }
        #endregion

        public void OnDeserialization(object sender)
        {
            this.uniqueContentHashes = this.items.Select(i => i.ContentHash).ToHashSet();
            this.itemsById = this.items.Select(i => new KeyValuePair<string, Transaction>(i.Id, i)).ToDictionary();
        }

        public int EditsCount
        {
            get { return this.edits.Count; }
        }

        public TransactionEdits GetClonedEdits()
        {
            return this.edits.Clone();
        }
    }
}
