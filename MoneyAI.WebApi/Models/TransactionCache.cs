using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web;
using System.IO;
using System.Web.Caching;
using System.Diagnostics;

namespace MoneyAI.WebApi.Models
{
    internal class TransactionCache
    {
        internal TransactionCache(string userId)
        {
            this.UserId = userId;
            this.dataPath = GetDataPath(userId);

            this.serializedJson = new Lazy<string>(() => File.ReadAllText(dataPath), System.Threading.LazyThreadSafetyMode.ExecutionAndPublication);
            this.transactions = new Lazy<Transactions>(() => Transactions.DeserializeFromJson(this.SerializedJson), System.Threading.LazyThreadSafetyMode.ExecutionAndPublication);
        }

        private Lazy<Transactions> transactions;
        private Lazy<string> serializedJson;
        private string dataPath;
        private Transactions Transactions { get { return transactions.Value; } }
        public string SerializedJson { get { return serializedJson.Value; } }
        public string UserId { get; private set; }

        private static string GetDataPath(string userId)
        {
            return Path.Combine(AppDomain.CurrentDomain.GetData("DataDirectory").ToString(), userId, "LatestMerged.json");
        }

        public int ApplyEdits(TransactionEdit[] edits)
        {
            lock (this.Transactions)
            {
                var affectedTransactionCount = 0;
                foreach(var edit in edits)
                {
                    affectedTransactionCount += this.Transactions.Apply(edit, false).Count();
                }

                if (this.serializedJson != null && this.serializedJson.IsValueCreated)
                    this.serializedJson = new Lazy<string>(() => SerializeTransactions(), System.Threading.LazyThreadSafetyMode.ExecutionAndPublication);
                this.Save();

                return affectedTransactionCount;
            }
        }

        private string SerializeTransactions()
        {
            lock (this.Transactions)
                return this.Transactions.SerializeToJson();
        }

        public void Save()
        {
            File.WriteAllText(this.dataPath, this.SerializedJson);
        }

        private static void OnCacheItemRemoved(string key, object o, CacheItemRemovedReason r)
        {
            Debug.WriteLine("%s %s %s", key, o.ToString(), r.ToString());
        }

        private static readonly object cacheGetOrAddLock = new object();
        public static TransactionCache GetItem(string userId)
        {
            var dataPath = GetDataPath(userId);
            var cachedValue = HttpRuntime.Cache[dataPath] as TransactionCache;
            if (cachedValue == null)
            {
                lock (cacheGetOrAddLock)
                {
                    cachedValue = HttpRuntime.Cache[dataPath] as TransactionCache;
                    if (cachedValue == null)
                    {
                        cachedValue = new TransactionCache(userId);
                        HttpRuntime.Cache.Add(dataPath, cachedValue, null
                            , Cache.NoAbsoluteExpiration, Cache.NoSlidingExpiration, CacheItemPriority.Normal, OnCacheItemRemoved);
                    }
                }
            }

            return cachedValue;
        }
    }
}