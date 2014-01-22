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
using System.Diagnostics;

namespace MoneyAI
{
    [DataContract]
    public class Transactions : IDeserializationCallback 
    {

        [DataMember(Name = "name")]
        public string Name { get; private set; }

        [DataMember(Name = "topItems", IsRequired = true)]
        private Dictionary<string, Transaction> topItemsById;

        private Dictionary<string, Transaction> allItemsById;
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
            this.topItemsById = new Dictionary<string, Transaction>();
            this.allItemsById = new Dictionary<string, Transaction>();

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
            get { return this.allItemsById[id]; }
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

        public void Merge(Transactions other, bool enableMatching)
        {
            //Enrich old transaction
            var currentItemPairs = other.AllParentChildTransactions
                //if there are content hash dups then ignore.
                .Where(t => t.CombinedToId == null &&
                    this.uniqueContentHashes.GetValueOrDefault(t.ContentHash, Utils.EmptyStringArray).Length == 1 &&
                    other.uniqueContentHashes.GetValueOrDefault(t.ContentHash, Utils.EmptyStringArray).Length == 1)
                .Select(t => Tuple.Create(this.uniqueContentHashes[t.ContentHash][0], t));
        
            foreach(var currentItemPair in currentItemPairs)
            {
                var tx = this.allItemsById.GetValueOrDefault(currentItemPair.Item1);
                var thisFormat = this.GetImportInfo(tx.ImportId).Format;
                var otherFormat = other.GetImportInfo(currentItemPair.Item2.ImportId).Format;
                if (tx.CombinedFromId != null || thisFormat == otherFormat || 
                    thisFormat == null || otherFormat == null || tx.AccountId != currentItemPair.Item2.AccountId)   //enrich only for different formats in same account
                {
                    continue;
                }

                tx.CombineAttributes(currentItemPair.Item2);
            }

            var newItems = other.TopLevelTransactions
                .Where(t => !this.uniqueContentHashes.ContainsKey(t.ContentHash))
                .Select(t => t.Clone()).ToList();

            this.topItemsById.AddRange(newItems.Select(i => new KeyValuePair<string, Transaction>(i.Id, i)));
            var allParentChildNewItems = FlattenTransactions(newItems).ToList();
            this.allItemsById.AddRange(allParentChildNewItems.Select(tx => new KeyValuePair<string, Transaction>(tx.Id, tx)));
            this.UpdateStateForFlattenedTransactions(allParentChildNewItems, other);
            this.edits.Merge(other.edits);

            if (enableMatching)
                this.MatchTransactions();
        }

        public void MatchTransactions()
        {
            this.MatchParentChild();
            this.MatchInterAccountTransfer(CrossInstituteTransferUnmatchedFilter);
            this.MatchInterAccountTransfer(InterInstituteTransferUnmatchedFilter, InterInstituteTransferMatchedFilter, 0.5, false);
        }

        private bool CrossInstituteTransferUnmatchedFilter(Transaction tx)
        {
            return tx.TransactionReason.Intersects(TransactionReason.NetInterAccount | TransactionReason.OtherCredit);
        }
        private bool InterInstituteTransferUnmatchedFilter(Transaction tx)
        {
            return tx.EntityName.IndexOf("transfer", StringComparison.InvariantCultureIgnoreCase) >= 0;
        }
        private bool InterInstituteTransferMatchedFilter(Transaction unmatchedTx, Transaction candidateTx)
        {
            return string.Equals(this.GetAccountInfo(unmatchedTx.AccountId).InstituteName, this.GetAccountInfo(candidateTx.AccountId).InstituteName, StringComparison.CurrentCultureIgnoreCase) &&
                this.GetAccountInfo(unmatchedTx.AccountId).InstituteName != null &&
                candidateTx.EntityName.IndexOf("transfer", StringComparison.InvariantCultureIgnoreCase) >= 0;
        }

        private void MatchInterAccountTransfer(Func<Transaction, bool> unmatchedFilter, Func<Transaction, Transaction, bool> matchedFilter = null, double transferDayTolerance = 3, bool enableNameTagFilter = true)
        {
            //TODO: this can be optimized to do be done only for new transactions we just added
            
            var txs = this.TopLevelTransactions;

            //Match all transactions that are potentially interaccount with their counter parts.
            var unmatchedTransfers = txs
                .Where(tx => unmatchedFilter(tx) && 
                    tx.RelatedTransferId == null && !this.GetAccountInfo(tx.AccountId).RequiresParent);

            //For each unmatched transfers, get matching items
            foreach(var unmatchedTx in unmatchedTransfers)
            {
                var searchAmount = unmatchedTx.Amount * -1;
                var searchDateMin = unmatchedTx.TransactionDate.AddDays(-transferDayTolerance);
                var searchDateMax = unmatchedTx.TransactionDate.AddDays(transferDayTolerance);
                var nameTags = this.GetAccountInfo(unmatchedTx.AccountId).InterAccountNameTags ?? Utils.EmptyStringArray;   //TODO: We can optimize on seeing if this is present before doing query

                var candidates = txs
                    .Where(ctx => ctx.Amount == searchAmount && ctx.AccountId != unmatchedTx.AccountId && (matchedFilter == null || matchedFilter(unmatchedTx, ctx)) &&
                        ctx.TransactionDate >= searchDateMin && ctx.TransactionDate <= searchDateMax && ctx.RelatedTransferId == null && 
                        !this.GetAccountInfo(ctx.AccountId).RequiresParent &&
                        (!enableNameTagFilter || nameTags.Any(nt => ctx.EntityName.IndexOf(nt, StringComparison.CurrentCultureIgnoreCase) >= 0)))
                    .OrderBy(ctx => Math.Abs(ctx.TransactionDate.Subtract(unmatchedTx.TransactionDate).TotalDays));
                var matchedTx = candidates.FirstOrDefault();

                if (matchedTx != null)
                    unmatchedTx.MatchInterAccount(matchedTx);
            }
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
            var parent = this.allItemsById[parentId];
            var child = this.allItemsById[childId];

            parent.AddChild(child);
            if (this.topItemsById.ContainsKey(child.Id))
                this.topItemsById.Remove(child.Id);
        }

        private void MatchParentChild()
        {
            //Find all transaction that requires parent but does not have parent
            var parentNeededGroups = this.TopLevelTransactions.Where(tx => tx.RequiresParent)
                .Select(tx => new { Tx = tx, Matcher = this.GetParentChildMatcher(tx) })
                .GroupBy(txm => txm.Matcher);

            var allParents = new HashSet<Transaction>();
            foreach (var parentNeededGroup in parentNeededGroups)
            {
                var children = parentNeededGroup.Select(txm => txm.Tx).ToArray();
                var childParents = parentNeededGroup.Key.GetParents(children, this)
                    .ToArray(); //TODO: Not needed unless itemsById is going to change

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

        public IEnumerable<Transaction> AllParentChildTransactions
        {
            get { return this.allItemsById.Values;  }
        }
        public IEnumerable<Transaction> TopLevelTransactions
        {
            get { return this.topItemsById.Values; }
        }

        private void UpdateStateForFlattenedTransactions(IList<Transaction> transactions, Transactions source)
        {
            foreach(var transaction in transactions)
            {
                var existingIds = new List<string>(this.uniqueContentHashes.GetValueOrDefault(transaction.ContentHash, Utils.EmptyStringArray));
                existingIds.Add(transaction.Id);
                this.uniqueContentHashes[transaction.ContentHash] = existingIds.ToArray();
            }

            this.accountInfos.AddRange(transactions.Select(i => i.AccountId).Distinct()
                .Where(aid => !this.accountInfos.ContainsKey(aid))
                .Select(aid => new KeyValuePair<string, AccountInfo>(aid, source.GetAccountInfo(aid))));
            this.importInfos.AddRange(transactions.Select(i => i.ImportId).Distinct()
                .Where(iid => !this.importInfos.ContainsKey(iid))
                .Select(iid => new KeyValuePair<string, ImportInfo>(iid, source.GetImportInfo(iid))));
        }

        /// <param name="allowDuplicate">Should be true when importing transactions from a file but false when merging items from two files</param>
        public bool AddNew(Transaction transaction, AccountInfo accountInfo, ImportInfo importInfo, bool allowDuplicate)
        {
            if (allowDuplicate || !uniqueContentHashes.ContainsKey(transaction.ContentHash))
            {
                this.topItemsById.Add(transaction.Id, transaction);
                var flattened = FlattenTransactions(Utils.AsEnumerable(transaction)).ToList();
                this.allItemsById.AddRange(flattened.Select(tx => new KeyValuePair<string, Transaction>(tx.Id, tx)));
                this.accountInfos.AddIfNotExist(accountInfo.Id, accountInfo);
                this.importInfos.AddIfNotExist(importInfo.Id, importInfo);
                this.UpdateStateForFlattenedTransactions(flattened, this);
                return true;
            }
            else return false;
        }

        public IEnumerable<AccountInfo> AccountInfos
        {
            get { return this.accountInfos.Values;  }
        }

        private void Clear()
        {
            this.uniqueContentHashes.Clear();
            this.allItemsById.Clear();
            this.topItemsById.Clear();
            this.accountInfos.Clear();
            this.importInfos.Clear();
        }
        
        #region Apply Edit
        private IEnumerable<Transaction> FilterTransactions(TransactionEdit edit)
        {
            var filteredTransactions = this.AllParentChildTransactions.ToList();
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
                    var isNegativeAmount = Utils.ParseBool(scopeFilter.Parameters[2], null);
                    if (isNegativeAmount)
                        return transaction.Amount <= Decimal.Parse(scopeFilter.Parameters[0])*-1 && transaction.Amount >= Decimal.Parse(scopeFilter.Parameters[1])*-1;
                    else
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

        private static IEnumerable<Transaction> FlattenTransactions(IEnumerable<Transaction> transactions)
        {
            if (transactions == null)
                yield break;

            foreach(var transaction in transactions)
            {
                yield return transaction;
                foreach (var tx in FlattenTransactions(transaction.Children))
                    yield return tx;
            }
        }
        public void OnDeserialization(object sender)
        {
            var k = this.topItemsById.Values.Where(t => t.ParentId != null).ToList();
            if (k.Count > 0)
                Debugger.Break();
            this.allItemsById = FlattenTransactions(this.topItemsById.Values).ToDictionary(tx => tx.Id, tx => tx);
            this.uniqueContentHashes = this.AllParentChildTransactions.GroupBy(i => i.ContentHash)
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
