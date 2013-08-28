using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using CommonUtils;

namespace MoneyInMotion
{
    public class Transactions : ICollection<Transaction>
    {
        private readonly IList<Transaction> items = new List<Transaction>();
        private readonly HashSet<string> uniqueIDs = new HashSet<string>();
        private readonly HashSet<string> locationHashes = new HashSet<string>();

        public Transactions(ICollection<Transaction> other = null)
        {
            if (other != null)
                this.Merge(other);
        }

        public IEnumerable<string> SerializeToJson()
        {
            return items.Select(item => item.SerializeToJson());
        }

        public static Transactions DeserializeFromJson(IEnumerable<string> serializedTransactions)
        {
            var transactionList = serializedTransactions.Select(Transaction.DeserializeFromJson).ToList();
            return new Transactions(transactionList);
        }

        public void Merge(ICollection<Transaction> itemsToAdd)
        {
            //First add transaction without updating IDs. THEN add IDs.
            this.items.AddRange(itemsToAdd.Where(i => !this.uniqueIDs.Contains(i.Id)));
            this.uniqueIDs.AddRange(itemsToAdd.Select(i => i.Id));
            this.locationHashes.AddRange(itemsToAdd.Select(i => i.ImportInfo.ContentHash));
        }

        public IEnumerator<Transaction> GetEnumerator()
        {
            return items.GetEnumerator();
        }

        IEnumerator IEnumerable.GetEnumerator()
        {
            return items.GetEnumerator();
        }

        public void Add(Transaction item)
        {
            Add(item, false);
        }

        public bool Add(Transaction item, bool allowDuplicate)
        {
            if (allowDuplicate || !uniqueIDs.Contains(item.Id))
            {
                items.Add(item);
                uniqueIDs.Add(item.Id);
                locationHashes.Add(item.ImportInfo.ContentHash);
                return true;
            }
            else return false;
        }

        public void Clear()
        {
            items.Clear();
            uniqueIDs.Clear();
            locationHashes.Clear();
        }

        public ICollection<string> LocationHashses
        {
            get { return this.locationHashes; }
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
    }
}
