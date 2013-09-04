using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CommonUtils
{
    public class ListSet<TKey, TItem> : ICollection<TItem>
    {
        private List<TItem> items = new List<TItem>();
        private HashSet<TKey> keys = new HashSet<TKey>();
        private Func<TItem, TKey> getKey;

        public ListSet(Func<TItem, TKey> getKey)
        {
            this.getKey = getKey;
        }

        public IEnumerator<TItem> GetEnumerator()
        {
            return this.items.GetEnumerator();
        }

        IEnumerator IEnumerable.GetEnumerator()
        {
            return this.items.GetEnumerator();
        }

        public void Add(TItem item)
        {
            var key = getKey(item);
            if (keys.Contains(key))
                throw new ArgumentException("Item with key {0} already exists".FormatEx(key.ToString()));

            items.Add(item);
            keys.Add(key);
        }

        public void Clear()
        {
            this.keys.Clear();
            this.items.Clear();
        }

        public bool Contains(TItem item)
        {
            var key = getKey(item);
            return keys.Contains(key);
        }

        public void CopyTo(TItem[] array, int arrayIndex)
        {
            this.items.CopyTo(array, arrayIndex);
        }

        public bool Remove(TItem item)
        {
            var key = getKey(item);
            this.keys.Remove(key);
            return this.items.Remove(item);
        }

        public int Count 
        {
            get { return this.items.Count; }
        }
        public bool IsReadOnly 
        {
            get { return false; }
        }
    }
}
