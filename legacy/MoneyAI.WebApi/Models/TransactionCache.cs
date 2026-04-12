using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.IO;
using System.Web.Caching;
using System.Diagnostics;
using System.Threading;

namespace MoneyAI.WebApi.Models
{
    internal class TransactionCache
    {
        private Lazy<Transactions> transactions;
        private Lazy<string> serializedJson;
        private string dataPath;
        private Transactions Transactions { get { return transactions.Value; } }

        private static readonly object lockObject = new object();

        private FileSystemWatcher fileWatcher = new FileSystemWatcher();
        private volatile bool isSaveInProgress = false;
        private long lastSaveTimeVolatile = DateTime.MinValue.ToBinary();
        private long LastSaveTime
        {
            get { return Volatile.Read(ref this.lastSaveTimeVolatile); }
            set { Volatile.Write(ref this.lastSaveTimeVolatile, value); }
        }

        public string SerializedJson { get { return serializedJson.Value; } }
        public string UserId { get; private set; }

        internal TransactionCache(string userId)
        {
            this.UserId = userId;
            this.dataPath = GetDataPath(userId);

            fileWatcher.Path = Path.GetDirectoryName(dataPath);
            fileWatcher.Filter = Path.GetFileName(dataPath);
            fileWatcher.IncludeSubdirectories = false;
            fileWatcher.NotifyFilter = NotifyFilters.LastWrite;
            fileWatcher.Changed += OnFileWatcherChange;
            fileWatcher.EnableRaisingEvents = true;

            ResetState();
        }

        private void ResetState()
        {
            lock(lockObject)
            {
                this.serializedJson = new Lazy<string>(() => File.ReadAllText(dataPath), System.Threading.LazyThreadSafetyMode.ExecutionAndPublication);
                this.transactions = new Lazy<Transactions>(() => Transactions.DeserializeFromJson(this.SerializedJson), System.Threading.LazyThreadSafetyMode.ExecutionAndPublication);
            }
        }

        private static string GetDataPath(string userId)
        {
            return Path.Combine(AppDomain.CurrentDomain.GetData("DataDirectory").ToString(), userId, "LatestMerged.json");
        }

        public int ApplyEdits(TransactionEdit[] edits)
        {
            lock (lockObject)
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
            lock (lockObject)
                return this.Transactions.SerializeToJson();
        }

        private void Save()
        {
            this.LastSaveTime = DateTime.UtcNow.ToBinary();
            this.isSaveInProgress = true;
            try
            {
                lock(lockObject)
                    File.WriteAllText(this.dataPath, this.SerializedJson);
            }
            finally
            {
                this.LastSaveTime = DateTime.UtcNow.ToBinary();
                this.isSaveInProgress = false;
            }
        }

        private void OnFileWatcherChange(object source, FileSystemEventArgs e)
        {
            Debug.WriteLine("File change: %s %s %s", e.ChangeType.ToString(), e.FullPath, e.Name);

            if (!this.isSaveInProgress && 
                DateTime.UtcNow.Subtract(DateTime.FromBinary(this.LastSaveTime)).TotalSeconds > 5)    //TODO: make this better
            {
                this.ResetState();
                Debug.WriteLine("Reseted state for UserID: " + this.UserId);
            }
        }

        private static TCache GetOrAddCacheItem<TCache>(string cacheKey, Func<TCache> createCacheValue, 
            string filePathDepenency = null, int? expireAfterMinutes = 20, CacheItemRemovedCallback onRemoveCallback = null) where TCache:class
        {
            var cacheValue = HttpRuntime.Cache[cacheKey] as TCache;
            if (cacheValue == null)
            {
                lock (lockObject)
                {
                    cacheValue = HttpRuntime.Cache[cacheKey] as TCache;
                    if (cacheValue == null)
                    {
                        cacheValue = createCacheValue();
                        HttpRuntime.Cache.Add(cacheKey, cacheValue,
                            filePathDepenency == null ? null : new CacheDependency(filePathDepenency),
                            Cache.NoAbsoluteExpiration, 
                            expireAfterMinutes != null ? new TimeSpan(0, expireAfterMinutes.Value, 0) : Cache.NoSlidingExpiration, 
                            CacheItemPriority.Normal, onRemoveCallback);
                    }
                }
            }

            return cacheValue;
        }

        public static TransactionCache GetItem(string userId)
        {
            var dataPath = GetDataPath(userId);
            var txCacheValue = GetOrAddCacheItem("TransactionCache_" + dataPath, () => new TransactionCache(userId), onRemoveCallback: OnCacheItemRemoved);
            return txCacheValue;
        }

        private static void OnCacheItemRemoved(string key, object value, CacheItemRemovedReason reason)
        {
            var txCacheValue = value as TransactionCache;
            if (txCacheValue.fileWatcher != null)
            {
                txCacheValue.fileWatcher.Dispose();
                txCacheValue.fileWatcher = null;
            }
        }
    }
}