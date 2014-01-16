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
        
        [DataMember(Name = "items", IsRequired=true)]
        private Dictionary<string, Transaction> itemsById;

        private Dictionary<string, string[]> uniqueContentHashes;


        [DataMember]
        private readonly Dictionary<string, AccountInfo> accountInfos;

        [DataMember]
        private readonly Dictionary<string, ImportInfo> importInfos;

        [DataMember]
        private readonly TransactionEdits edits;


        public Transactions(string name)
        {
            this.Name = name;
            this.uniqueContentHashes = new Dictionary<string, string[]>();
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
            return this.uniqueContentHashes.ContainsKey(contentHash);
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
            //Enrich old transaction
            var currentItemPairs = other
                //if there are content hash dups then ignore.
                .Where(t => t.CombinedToId == null &&
                    this.uniqueContentHashes.GetValueOrDefault(t.ContentHash, Utils.EmptyStringArray).Length == 1 &&
                    other.uniqueContentHashes.GetValueOrDefault(t.ContentHash, Utils.EmptyStringArray).Length == 1)
                .Select(t => Tuple.Create(this.uniqueContentHashes[t.ContentHash][0], t));
        
            foreach(var currentItemPair in currentItemPairs)
            {
                var tx = this.itemsById.GetValueOrDefault(currentItemPair.Item1);
                //TODO: may be childs should be kept track in seperate dictionary?
                if (tx == null)
                    continue;   //Item was moved to be child

                var thisFormat = this.GetImportInfo(tx.ImportId).Format;
                var otherFormat = other.GetImportInfo(currentItemPair.Item2.ImportId).Format;
                if (tx.CombinedFromId != null || thisFormat == otherFormat || thisFormat == null || otherFormat == null)
                    continue;

                tx.CombineAttributes(currentItemPair.Item2);
            }

            var newItems = other
                .Where(t => !this.uniqueContentHashes.ContainsKey(t.ContentHash))
                .Select(t => t.Clone()).ToList();

            this.itemsById.AddRange(newItems.Select(i => new KeyValuePair<string, Transaction>(i.Id, i)));
            this.uniqueContentHashes.AddRange(newItems.GroupBy(i => i.ContentHash).Select(g =>
                new KeyValuePair<string,string[]>(g.Key, other.uniqueContentHashes[g.Key])));
            this.accountInfos.AddRange(newItems.Select(i => i.AccountId).Where(aid => !this.accountInfos.ContainsKey(aid)).Select(aid =>
                new KeyValuePair<string, AccountInfo>(aid, other.GetAccountInfo(aid))));
            this.importInfos.AddRange(newItems.Select(i => i.ImportId).Where(iid => !this.importInfos.ContainsKey(iid)).Select(iid =>
                new KeyValuePair<string, ImportInfo>(iid, other.GetImportInfo(iid))));
            this.edits.Merge(other.edits);

            this.MatchParentChild();
        }

        static readonly IDictionary<string, IParentChildMatch> parentChildMatchers = new Dictionary<string, IParentChildMatch>();
        static readonly IParentChildMatch genericMatcher = new ParentChildMatchers.GenericTxParentChildMatcher();
        private IParentChildMatch GetParentChildMatcher(Transaction tx, bool allowGenericMatcher = false)
        {
            //TODO: move this to configurable plugin option
            IParentChildMatch existing;

            var key = string.Concat(this.accountInfos[tx.AccountId].InstituteName, "|", this.accountInfos[tx.AccountId].Type.ToString());
            if (!parentChildMatchers.TryGetValue(key, out existing))
            {
                switch(key)
                {
                    case "Amazon|OrderHistory":
                        existing = new ParentChildMatchers.AmazonOrderMatcher(this.accountInfos[tx.AccountId]);
                        break;
                    case "Etsy|OrderHistory":
                        existing = new ParentChildMatchers.EtsyOrderMatcher(this.accountInfos[tx.AccountId]);
                        break;
                    default:
                        if (!allowGenericMatcher)
                            throw new NotSupportedException("ParentChildMatcher for the key {0} is not supported".FormatEx(key));
                        else
                            return genericMatcher;
                }

                parentChildMatchers.Add(key, existing);
            }

            return existing;
        }

        public void RelateParentChild(string parentId, string childId)
        {
            var parent = this.itemsById[parentId];
            var child = this.itemsById[childId];

            parent.AddChild(child);

            //TODO: may be itemsById should for finding either parent or child and we should have seperate Items list that has active items
            this.itemsById.Remove(child.Id);
            //Keep other data as-is, especially uniq content hash so we don't get it again from somewhere else else in merges
        }

        public void MatchParentChild()
        {
            //Find all transaction that requires parent but does not have parent
            var parentNeededGroups = this.itemsById.Values.Where(tx => tx.RequiresParent && tx.ParentId == null)
                .Select(tx => new { Tx = tx, Matcher = this.GetParentChildMatcher(tx) })
                .GroupBy(txm => txm.Matcher);

            var allParents = new HashSet<Transaction>();
            foreach (var parentNeededGroup in parentNeededGroups)
            {
                var children = parentNeededGroup.Select(txm => txm.Tx).ToArray();
                var childParents = parentNeededGroup.Key.GetParents(children, this)
                    .ToArray(); //Because we'll change .itemsById collection

                foreach (var childParent in childParents)
                {
                    var parent = childParent.Value;
                    var child = childParent.Key;

                    this.RelateParentChild(parent.Id, child.Id);
                    allParents.Add(parent);
                }
            }

            foreach(var parent in allParents)
            {
                CompleteParent(parent);
            }
        }

        private void CompleteParent(Transaction parent)
        {
            decimal missingChildAmount;
            if (!parent.CompleteParent(out missingChildAmount))
            {
                var matcher = this.GetParentChildMatcher(parent, true);  //TODO: do we need to handle multiple types?
                if (matcher.HandleIncompleteParent(parent, this, missingChildAmount))
                    parent.CompleteParent(out missingChildAmount);
            }
        }

        /// <param name="allowDuplicate">Should be true when importing transactions from a file but false when merging items from two files</param>
        public bool AddNew(Transaction transaction, AccountInfo accountInfo, ImportInfo importInfo, bool allowDuplicate)
        {
            if (allowDuplicate || !uniqueContentHashes.ContainsKey(transaction.ContentHash))
            {
                this.itemsById.Add(transaction.Id, transaction);
                var existingIds = new List<string>(this.uniqueContentHashes.GetValueOrDefault(transaction.ContentHash, Utils.EmptyStringArray));
                existingIds.Add(transaction.Id);
                this.uniqueContentHashes[transaction.ContentHash] = existingIds.ToArray();
                this.accountInfos.AddIfNotExist(accountInfo.Id, accountInfo);
                this.importInfos.AddIfNotExist(importInfo.Id, importInfo);
                return true;
            }
            else return false;
        }

        public IEnumerable<AccountInfo> AccountInfos
        {
            get { return this.accountInfos.Values;  }
        }

        #region ICollection 

        public IEnumerator<Transaction> GetEnumerator()
        {
            return itemsById.Values.GetEnumerator();
        }

        IEnumerator IEnumerable.GetEnumerator()
        {
            return itemsById.Values.GetEnumerator();
        }

        public void Clear()
        {
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
            itemsById.Values.CopyTo(array, arrayIndex);
        }

        public int Count
        {
            get { return itemsById.Count; }
        }

        public bool IsReadOnly
        {
            get { return false; }
        }

        public bool Remove(Transaction item)
        {
            throw new NotSupportedException();
        }

        [Obsolete("Use AddNew")]
        public void Add(Transaction item)
        {
            throw new NotImplementedException();
        }
        #endregion

        #region Apply Edit
        private IEnumerable<Transaction> FilterTransactions(TransactionEdit edit)
        {
            var filteredTransactions = this.itemsById.Values.ToList();
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
            this.uniqueContentHashes = this.itemsById.Values.GroupBy(i => i.ContentHash)
                .ToDictionary(g => g.Key, g => g.Select(t => t.Id).ToArray());
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
